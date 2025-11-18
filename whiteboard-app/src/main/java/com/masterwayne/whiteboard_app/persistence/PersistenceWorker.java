package com.masterwayne.whiteboard_app.persistence;

import com.masterwayne.whiteboard_app.exception.PersistenceException;
import com.masterwayne.whiteboard_app.model.ChatMessage;
import com.masterwayne.whiteboard_app.model.DrawPayload;
import com.masterwayne.whiteboard_app.repository.WhiteboardSessionRepository;
import com.masterwayne.whiteboard_app.storage.FallbackStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.*;

/**
 * PersistenceWorker manages asynchronous persistence of drawing and chat events using a background thread.
 * 
 * Design:
 * - Uses a BlockingQueue to decouple WebSocket event handlers from persistence logic
 * - Single-threaded executor ensures serialized DB writes (no race conditions)
 * - On DB write failure, automatically falls back to file-based storage
 * - Graceful shutdown with queue draining on application termination
 * 
 * Thread safety:
 * - BlockingQueue is thread-safe for producer/consumer coordination
 * - All repository operations executed on single background thread (no concurrent DB access from this worker)
 */
@Component
public class PersistenceWorker {
    private static final Logger logger = LoggerFactory.getLogger(PersistenceWorker.class);
    private static final int QUEUE_CAPACITY = 1000;
    private static final int SHUTDOWN_TIMEOUT_SECONDS = 10;

    private final BlockingQueue<PersistenceTask> taskQueue;
    private final ExecutorService executorService;
    private final WhiteboardSessionRepository sessionRepository;
    private final FallbackStorage fallbackStorage;
    private final TransactionTemplate transactionTemplate;
    private volatile boolean running = false;

    @Autowired
    public PersistenceWorker(WhiteboardSessionRepository sessionRepository,
                             FallbackStorage fallbackStorage,
                             PlatformTransactionManager transactionManager) {
        this.sessionRepository = sessionRepository;
        this.fallbackStorage = fallbackStorage;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.taskQueue = new LinkedBlockingQueue<>(QUEUE_CAPACITY);
        this.executorService = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "WhiteboardPersistenceWorker");
            t.setDaemon(false);
            return t;
        });
    }

    /**
     * Starts the background worker thread. Called via @PostConstruct.
     */
    public void start() {
        if (running) {
            logger.warn("PersistenceWorker is already running");
            return;
        }

        running = true;
        executorService.submit(this::consumerLoop);
        logger.info("PersistenceWorker started");
    }

    /**
     * Main consumer loop: continuously reads tasks from queue and executes persistence.
     * Runs on the background thread.
     */
    private void consumerLoop() {
        logger.info("PersistenceWorker consumer loop started on thread: {}", Thread.currentThread().getName());

        while (running) {
            try {
                // Take a task from the queue (blocking, waits indefinitely)
                PersistenceTask task = taskQueue.take();
                executePersistenceTask(task);
            } catch (InterruptedException e) {
                if (running) {
                    // Unexpected interruption; log and continue
                    logger.warn("PersistenceWorker interrupted unexpectedly", e);
                    Thread.currentThread().interrupt();
                } else {
                    // Shutdown signal; break loop
                    logger.info("PersistenceWorker consumer loop interrupted during shutdown");
                    Thread.currentThread().interrupt();
                    break;
                }
            } catch (Exception e) {
                logger.error("Unexpected error in PersistenceWorker consumer loop", e);
            }
        }

        logger.info("PersistenceWorker consumer loop exiting");
    }

    /**
     * Executes a single persistence task with retry logic and fallback.
     */
    private void executePersistenceTask(PersistenceTask task) {
        try {
            // Ensure the persistence operation runs inside a Spring-managed transaction so
            // JPA/Hibernate lazy collections (e.g. session.getChannels()) can be initialized
            // correctly when accessed on the background worker thread.
            transactionTemplate.execute(status -> {
                try {
                    task.execute(sessionRepository);
                    return null;
                } catch (Exception e) {
                    // rethrow as runtime so TransactionTemplate will propagate
                    throw new RuntimeException(e);
                }
            });

            logger.debug("Persistence task completed successfully: {}", task.getDescription());
        } catch (RuntimeException e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            logger.error("Persistence task failed: {}. Attempting fallback storage.", task.getDescription(), cause);
            // Attempt fallback
            try {
                task.writeFallback(fallbackStorage);
                logger.warn("Event successfully written to fallback storage: {}", task.getDescription());
            } catch (Exception fallbackEx) {
                logger.error("Fallback storage also failed for task: {}", task.getDescription(), fallbackEx);
            }
        } catch (Exception e) {
            logger.error("Unexpected error executing persistence task: {}", task.getDescription(), e);
        }
    }

    /**
     * Submits a draw event for asynchronous persistence.
     * Returns false if queue is full (backpressure).
     */
    public boolean submitDrawEvent(String sessionName, String channelName, DrawPayload payload) {
        if (!running) {
            logger.warn("PersistenceWorker is not running. Event discarded: session={}, channel={}", sessionName, channelName);
            return false;
        }

        PersistenceTask task = PersistenceTask.drawTask(sessionName, channelName, payload);
        boolean submitted = taskQueue.offer(task);

        if (!submitted) {
            logger.error("PersistenceWorker queue full. Event discarded: session={}, channel={}", sessionName, channelName);
        }

        return submitted;
    }

    /**
     * Submits a chat message for asynchronous persistence.
     * Returns false if queue is full (backpressure).
     */
    public boolean submitChatMessage(String sessionName, String channelName, ChatMessage message) {
        if (!running) {
            logger.warn("PersistenceWorker is not running. Message discarded: session={}, channel={}", sessionName, channelName);
            return false;
        }

        PersistenceTask task = PersistenceTask.chatTask(sessionName, channelName, message);
        boolean submitted = taskQueue.offer(task);

        if (!submitted) {
            logger.error("PersistenceWorker queue full. Message discarded: session={}, channel={}", sessionName, channelName);
        }

        return submitted;
    }

    /**
     * Gracefully shuts down the worker thread, draining remaining tasks before terminating.
     * Called via @PreDestroy.
     */
    public void shutdown() {
        if (!running) {
            logger.info("PersistenceWorker is not running");
            return;
        }

        logger.info("Shutting down PersistenceWorker...");
        running = false;

        // Signal the consumer thread to stop
        executorService.shutdown();

        try {
            if (executorService.awaitTermination(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                logger.info("PersistenceWorker shut down gracefully");
            } else {
                logger.warn("PersistenceWorker shutdown timeout. Forcing termination.");
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            logger.error("Interrupted while waiting for PersistenceWorker shutdown", e);
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }

        // Drain any remaining tasks from the queue
        int drained = 0;
        PersistenceTask remainingTask;
        while ((remainingTask = taskQueue.poll()) != null) {
            try {
                executePersistenceTask(remainingTask);
                drained++;
            } catch (Exception e) {
                logger.error("Error processing remaining task during shutdown", e);
            }
        }

        if (drained > 0) {
            logger.info("Drained {} remaining tasks during shutdown", drained);
        }
    }

    /**
     * Returns the current size of the persistence queue.
     */
    public int getQueueSize() {
        return taskQueue.size();
    }

    /**
     * Returns the remaining capacity of the queue.
     */
    public int getQueueCapacity() {
        return taskQueue.remainingCapacity();
    }

    /**
     * Abstract base class for persistence tasks.
     * Implements Factory pattern for different task types.
     */
    public abstract static class PersistenceTask {
        protected final String sessionName;
        protected final String channelName;

        public PersistenceTask(String sessionName, String channelName) {
            this.sessionName = sessionName;
            this.channelName = channelName;
        }

        /**
         * Executes the persistence operation (DB write).
         */
        public abstract void execute(WhiteboardSessionRepository repository) throws Exception;

        /**
         * Writes the event to fallback storage if DB write failed.
         */
        public abstract void writeFallback(FallbackStorage storage);

        /**
         * Returns a human-readable description of the task.
         */
        public abstract String getDescription();

        /**
         * Factory method for draw event tasks.
         */
        public static PersistenceTask drawTask(String sessionName, String channelName, DrawPayload payload) {
            return new DrawPersistenceTask(sessionName, channelName, payload);
        }

        /**
         * Factory method for chat message tasks.
         */
        public static PersistenceTask chatTask(String sessionName, String channelName, ChatMessage message) {
            return new ChatPersistenceTask(sessionName, channelName, message);
        }
    }

    /**
     * Task for persisting a draw event.
     */
    private static class DrawPersistenceTask extends PersistenceTask {
        private final DrawPayload payload;

        public DrawPersistenceTask(String sessionName, String channelName, DrawPayload payload) {
            super(sessionName, channelName);
            this.payload = payload;
        }

        @Override
        public void execute(WhiteboardSessionRepository repository) throws Exception {
            var session = repository.findBySessionName(sessionName)
                    .orElseThrow(() -> new PersistenceException("Session '" + sessionName + "' not found for persisting shape"));

            var channel = session.getChannels().stream()
                    .filter(c -> c.getChannelName().equals(channelName))
                    .findFirst()
                    .orElseThrow(() -> new PersistenceException("Channel '" + channelName + "' not found in session"));

            channel.getShapes().add(payload);
            repository.save(session);
        }

        @Override
        public void writeFallback(FallbackStorage storage) {
            storage.writeDrawPayload(sessionName, channelName, payload);
        }

        @Override
        public String getDescription() {
            return String.format("DrawEvent{session='%s', channel='%s', type='%s'}", sessionName, channelName, payload.getType());
        }
    }

    /**
     * Task for persisting a chat message.
     */
    private static class ChatPersistenceTask extends PersistenceTask {
        private final ChatMessage message;

        public ChatPersistenceTask(String sessionName, String channelName, ChatMessage message) {
            super(sessionName, channelName);
            this.message = message;
        }

        @Override
        public void execute(WhiteboardSessionRepository repository) throws Exception {
            var session = repository.findBySessionName(sessionName)
                    .orElseThrow(() -> new PersistenceException("Session '" + sessionName + "' not found for persisting chat"));

            var channel = session.getChannels().stream()
                    .filter(c -> c.getChannelName().equals(channelName))
                    .findFirst()
                    .orElseThrow(() -> new PersistenceException("Channel '" + channelName + "' not found in session"));

            channel.getChatMessages().add(message);
            repository.save(session);
        }

        @Override
        public void writeFallback(FallbackStorage storage) {
            storage.writeChatMessage(sessionName, channelName, message);
        }

        @Override
        public String getDescription() {
            return String.format("ChatMessage{session='%s', channel='%s', sender='%s'}", sessionName, channelName, message.getSenderName());
        }
    }
}

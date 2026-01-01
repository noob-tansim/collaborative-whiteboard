package com.masterwayne.whiteboard_app.config;

import com.masterwayne.whiteboard_app.persistence.PersistenceWorker;
import com.masterwayne.whiteboard_app.storage.FallbackStorage;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MonitoringConfig {

    @Bean
    public ApplicationRunner persistenceMetricsBinder(PersistenceWorker worker,
                                                       FallbackStorage fallbackStorage,
                                                       MeterRegistry registry) {
        return args -> {
            Gauge.builder("whiteboard.persistence.queue.size", worker, PersistenceWorker::getQueueSize)
                    .description("Current size of the async persistence queue")
                    .register(registry);

            Gauge.builder("whiteboard.persistence.queue.capacity", worker, PersistenceWorker::getQueueCapacity)
                    .description("Remaining capacity in the async persistence queue")
                    .register(registry);

            Gauge.builder("whiteboard.fallback.events", fallbackStorage, FallbackStorage::getFallbackEventCount)
                    .description("Number of events waiting in fallback storage")
                    .register(registry);

            Gauge.builder("whiteboard.fallback.file.size.bytes", fallbackStorage, FallbackStorage::getFallbackFileSizeBytes)
                    .description("Size of the fallback JSONL file on disk")
                    .register(registry);
        };
    }
}

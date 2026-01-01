import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ChannelManager.css';

function ChannelManager({ 
  sessionName, 
  userName, 
  currentChannel, 
  channels, 
  onChannelSelect,
  onChannelCreate,
  onLogout,
  darkMode 
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1: server info, 2: channel type, 3: channel name
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelLogo, setNewChannelLogo] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [channelType, setChannelType] = useState('text'); // 'text' or 'private'
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
        setNewChannelLogo(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) return;

    const channelData = {
      name: newChannelName.trim(),
      logo: newChannelLogo || uploadedImage || '📝',
      type: channelType,
      createdBy: userName
    };

    onChannelCreate(channelData);
    setNewChannelName('');
    setNewChannelLogo('');
    setUploadedImage(null);
    setChannelType('text');
    setShowCreateModal(false);
    setModalStep(1);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setModalStep(1);
    setNewChannelName('');
    setUploadedImage(null);
    setChannelType('text');
  };

  const handleNextStep = () => {
    if (modalStep === 1) {
      setModalStep(2);
    } else if (modalStep === 2 && channelType) {
      setModalStep(3);
    }
  };

  const handleBackStep = () => {
    if (modalStep > 1) {
      setModalStep(modalStep - 1);
    }
  };

  return (
    <>
      <motion.div 
        className={`channel-sidebar ${isCollapsed ? 'collapsed' : ''} ${darkMode ? 'dark-mode' : ''}`}
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 100 }}
      >
        {/* Collapse Toggle */}
        <motion.button
          className="collapse-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isCollapsed ? '→' : '←'}
        </motion.button>

        <div className="sidebar-content">
          {/* Session Header */}
          <div className="session-header">
            <motion.div 
              className="session-avatar"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              {sessionName.charAt(0).toUpperCase()}
            </motion.div>
            {!isCollapsed && (
              <div className="session-info">
                <h3 className="session-name">{sessionName}</h3>
                <p className="session-user">@{userName}</p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <>
              {/* Text Channels Section */}
              <div className="channels-section">
                <div className="section-header">
                  <span className="section-icon">▼</span>
                  <span className="section-title">Text Channels</span>
                  <motion.button
                    className="add-channel-btn"
                    onClick={() => setShowCreateModal(true)}
                    whileHover={{ scale: 1.2, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    +
                  </motion.button>
                </div>

                <div className="channels-list">
                  {channels.map((channel, index) => (
                    <motion.div
                      key={channel.name}
                      className={`channel-item ${currentChannel === channel.name ? 'active' : ''}`}
                      onClick={() => onChannelSelect(channel.name)}
                      whileHover={{ x: 5 }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <span className="channel-logo">{channel.logo || '📝'}</span>
                      <span className="channel-name">{channel.name}</span>
                      {channel.type === 'private' && (
                        <span className="channel-lock">🔒</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Create Channel Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseModal}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Step 1: Server Info */}
              {modalStep === 1 && (
                <>
                  <div className="modal-header">
                    <button className="modal-back-btn" onClick={handleCloseModal}>
                      ←
                    </button>
                    <h3 className="modal-title">Tell Us More About Your Server</h3>
                    <p className="modal-subtitle">
                      In order to help you with your setup, is your new server for just a few friends or a larger community?
                    </p>
                    <button className="modal-close" onClick={handleCloseModal}>
                      ✕
                    </button>
                  </div>

                  <div className="modal-body">
                    <div className="server-type-section">
                      <div className="server-type-option" onClick={() => handleNextStep()}>
                        <div className="server-type-icon">💬</div>
                        <div className="server-type-text">For me and my friends</div>
                      </div>
                      
                      <div className="server-type-option" onClick={() => handleNextStep()}>
                        <div className="server-type-icon">🌐</div>
                        <div className="server-type-text">For a club or community</div>
                      </div>
                    </div>

                    <div className="modal-skip">
                      <p>
                        Not sure? You can{' '}
                        <button className="skip-link" onClick={() => setModalStep(2)}>
                          skip this question
                        </button>{' '}
                        for now.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Channel Type */}
              {modalStep === 2 && (
                <>
                  <div className="modal-header">
                    <button className="modal-back-btn" onClick={handleBackStep}>
                      ←
                    </button>
                    <h3 className="modal-title">Create Your Server</h3>
                    <p className="modal-subtitle">
                      Your server is where you and your friends hang out. Make yours and start talking.
                    </p>
                    <button className="modal-close" onClick={handleCloseModal}>
                      ✕
                    </button>
                  </div>

                  <div className="modal-body">
                    <div className="server-setup-section">
                      <label htmlFor="server-image-upload" className="server-upload-circle">
                        <input
                          id="server-image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          style={{ display: 'none' }}
                        />
                        {uploadedImage ? (
                          <img src={uploadedImage} alt="Server" className="uploaded-server-image" />
                        ) : (
                          <div className="upload-icon">📷</div>
                        )}
                        <button 
                          type="button"
                          className="upload-plus"
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById('server-image-upload').click();
                          }}
                        >
                          +
                        </button>
                      </label>
                      <p className="upload-label">UPLOAD</p>
                      
                      <div className="modal-input-group" style={{ marginTop: '20px' }}>
                        <label className="modal-label">Server Name</label>
                        <input
                          type="text"
                          className="modal-input"
                          placeholder={`${userName}'s server`}
                          value={newChannelName}
                          onChange={(e) => setNewChannelName(e.target.value)}
                          autoFocus
                        />
                      </div>

                      <div className="modal-disclaimer">
                        <p>
                          By creating a server, you agree to Discord's{' '}
                          <span className="link-text">Community Guidelines</span>.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <motion.button
                      className="modal-btn back-btn-footer"
                      onClick={handleBackStep}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Back
                    </motion.button>
                    <motion.button
                      className="modal-btn create-btn"
                      onClick={handleNextStep}
                      disabled={!newChannelName.trim()}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Create Server
                    </motion.button>
                  </div>
                </>
              )}

              {/* Step 3: Channel Details (if needed) */}
              {modalStep === 3 && (
                <>
                  <div className="modal-header">
                    <button className="modal-back-btn" onClick={handleBackStep}>
                      ←
                    </button>
                    <h3 className="modal-title">Create Channel</h3>
                    <p className="modal-subtitle">in {sessionName}</p>
                    <button className="modal-close" onClick={handleCloseModal}>
                      ✕
                    </button>
                  </div>

                  <div className="modal-body">
                    {/* Channel Type Selection */}
                    <div className="channel-type-section">
                      <label className="modal-section-label">Channel Type</label>
                      
                      <div
                        className={`type-option ${channelType === 'text' ? 'selected' : ''}`}
                        onClick={() => setChannelType('text')}
                      >
                        <div className="type-icon">#</div>
                        <div className="type-info">
                          <h4>Text Channel</h4>
                          <p>Send messages, images, GIFs, emoji, opinions, and puns</p>
                        </div>
                        <div className="type-radio">
                          {channelType === 'text' && <div className="radio-dot"></div>}
                        </div>
                      </div>

                      <div
                        className={`type-option ${channelType === 'private' ? 'selected' : ''}`}
                        onClick={() => setChannelType('private')}
                      >
                        <div className="type-icon">🔒</div>
                        <div className="type-info">
                          <h4>Private Channel</h4>
                          <p>Only selected members and roles will be able to view this channel</p>
                        </div>
                        <div className="type-radio">
                          {channelType === 'private' && <div className="radio-dot"></div>}
                        </div>
                      </div>
                    </div>

                    {/* Channel Name Input */}
                    <div className="modal-input-group">
                      <label className="modal-label">Channel Name</label>
                      <input
                        type="text"
                        className="modal-input"
                        placeholder="new-channel"
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateChannel()}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <motion.button
                      className="modal-btn cancel-btn"
                      onClick={handleCloseModal}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      className="modal-btn create-btn"
                      onClick={handleCreateChannel}
                      disabled={!newChannelName.trim()}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Create Channel
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ChannelManager;

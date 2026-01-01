import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './HomePage.css';

function HomePage() {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100
      }
    }
  };

  const features = [
    {
      icon: '🎨',
      title: 'Real-time Drawing',
      description: 'Collaborate with your team in real-time with smooth, responsive drawing tools'
    },
    {
      icon: '💬',
      title: 'Integrated Chat',
      description: 'Communicate seamlessly with built-in chat channels for each whiteboard session'
    },
    {
      icon: '🔄',
      title: 'Multi-Channel Support',
      description: 'Organize your work with multiple channels, just like your favorite collaboration tools'
    }
  ];

  return (
    <div className="homepage-container">
      {/* Animated Background */}
      <div className="animated-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <motion.div
        className="homepage-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Hero Section */}
        <motion.div className="hero-section" variants={itemVariants}>
          <h1 className="hero-title">
            Welcome to <span className="inkflow-text">inkFlow</span>
          </h1>
          <motion.p 
            className="hero-description"
            variants={itemVariants}
          >
            A modern collaborative whiteboard platform where ideas flow freely.
            Create, share, and innovate together in real-time.
          </motion.p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div className="action-buttons" variants={itemVariants}>
          <motion.button
            className="action-btn create-btn"
            onClick={() => navigate('/session-form?mode=create')}
            whileHover={{ scale: 1.05, boxShadow: '0 10px 40px rgba(139, 92, 246, 0.4)' }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="btn-icon">✨</span>
            <span className="btn-text">Create Session</span>
            <div className="btn-glow"></div>
          </motion.button>

          <motion.button
            className="action-btn join-btn"
            onClick={() => navigate('/session-form?mode=join')}
            whileHover={{ scale: 1.05, boxShadow: '0 10px 40px rgba(59, 130, 246, 0.4)' }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="btn-icon">🚀</span>
            <span className="btn-text">Join Session</span>
            <div className="btn-glow"></div>
          </motion.button>
        </motion.div>

        {/* Features Section */}
        <motion.div className="features-grid" variants={itemVariants}>
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="feature-card"
              variants={itemVariants}
              whileHover={{ 
                y: -10, 
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                transition: { type: 'spring', stiffness: 300 }
              }}
            >
              <div className="feature-icon-container">
                <motion.div
                  className="feature-icon"
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.6 }}
                >
                  {feature.icon}
                </motion.div>
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
              <div className="feature-card-glow"></div>
            </motion.div>
          ))}
        </motion.div>

        {/* Floating Particles */}
        <div className="floating-particles">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 10}s`
              }}
            ></div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default HomePage;

# inkFlow - Modern Collaborative Whiteboard

## 🎨 Overview

**inkFlow** is a beautifully redesigned collaborative whiteboard application featuring a modern, animated UI with Discord-like channel management. The frontend has been completely transformed with professional animations, color gradients, and an intuitive user experience.

## ✨ Key Features

### 1. **Animated Landing Page (HomePage)**
- **Dynamic "inkFlow" Title**: Multi-colored gradient animation that flows through the letters
- **Floating Gradient Orbs**: Animated background effects creating depth and motion
- **Feature Cards**: Three interactive cards showcasing:
  - Real-time Drawing
  - Integrated Chat
  - Multi-Channel Support
- **Animated Buttons**: 
  - Create Session (purple gradient)
  - Join Session (blue gradient)
  - Hover effects with glowing shadows
- **Floating Particles**: Subtle particle animation in the background

### 2. **Session Form Page**
- **Separate Route**: `/session-form?mode=create` or `/session-form?mode=join`
- **Back Button**: Animated arrow button to return to home
- **Mode Switching**: Toggle between Create and Join without losing context
- **Form Features**:
  - Labeled inputs with emoji icons
  - Real-time validation
  - Loading states with spinner animation
  - Error messages with styling
  - Gradient top border animation
- **Glassmorphism Design**: Frosted glass effect with backdrop blur

### 3. **Discord-like Channel Manager**
- **Sidebar Navigation**: Collapsible sidebar (280px → 72px)
- **Session Header**: 
  - Circular avatar with gradient
  - Session name and username
  - Animated on hover
- **Channel List**:
  - Custom channel logos (emoji or custom)
  - Public/Private indicators (🔒 for private)
  - Active channel highlighting
  - Smooth hover effects
- **Create Channel Modal**:
  - Channel type selector (Public/Private)
  - Logo picker with preset emojis
  - Custom emoji input
  - Animated modal entrance
- **User Panel**:
  - User avatar with online status indicator
  - Logout button with hover effects
- **Responsive**: Collapses on mobile devices

### 4. **Enhanced Whiteboard Page**
- **Integrated Layout**:
  - Channel sidebar on the left
  - Canvas in the center
  - Chat panel on the right
- **Channel Header**:
  - Current channel icon and name
  - Connection status with animated pulse
- **Real-time Features**:
  - Multi-channel support
  - Channel-specific drawing and chat
  - Automatic reconnection on channel switch

### 5. **Modern UI/UX Elements**

#### Color Palette (CSS Variables)
```css
--primary-color: #8b5cf6 (Purple)
--secondary-color: #3b82f6 (Blue)
--accent-color: #ec4899 (Pink)
--background-dark: #0f0f23 (Deep Navy)
--text-primary: #ffffff (White)
--text-secondary: #a0a0a0 (Gray)
```

#### Animations
- **Framer Motion**: Used throughout for smooth, spring-based animations
- **Gradient Flows**: Moving color gradients on text and backgrounds
- **Hover Effects**: Scale, shadow, and color transitions
- **Page Transitions**: Fade and scale effects on route changes
- **Loading States**: Spinning indicators and pulsing elements

## 📁 Project Structure

```
whiteboard-frontend/
├── src/
│   ├── HomePage.js              # Landing page with animated features
│   ├── HomePage.css             # Styles for landing page
│   ├── SessionForm.js           # Create/Join session form
│   ├── SessionForm.css          # Form styling with glassmorphism
│   ├── ChannelManager.js        # Discord-like sidebar
│   ├── ChannelManager.css       # Channel manager styles
│   ├── WhiteboardPage.js        # Main whiteboard with channels
│   ├── WhiteboardPage.css       # Updated layout styles
│   ├── Canvas.js                # Drawing canvas component
│   ├── Chat.js                  # Chat component
│   ├── App.js                   # Updated routing
│   ├── App.css                  # Global app styles
│   ├── index.css                # Base styles and resets
│   └── ...
└── package.json                 # Added framer-motion dependency
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Backend server running on port 8081

### Installation

1. **Install Dependencies**
```bash
cd whiteboard-frontend
npm install
```

2. **Start Development Server**
```bash
npm start
```

The app will open at `http://localhost:3000`

### Backend Connection
The frontend proxies API calls to `http://localhost:8081`. Ensure your backend is running.

## 🎯 User Flow

1. **Landing Page** (`/`)
   - User sees animated inkFlow title
   - Reads feature descriptions
   - Clicks "Create Session" or "Join Session"

2. **Session Form** (`/session-form`)
   - Enters session name and username
   - Can switch between Create/Join modes
   - Submits form → redirected to Whiteboard

3. **Whiteboard** (`/whiteboard`)
   - Sees channel sidebar with default channels
   - Can create new channels with custom logos
   - Switch between channels to access different whiteboards
   - Draw on canvas and chat in real-time
   - Logout returns to landing page

## 🎨 Design Highlights

### Animations
- **Text Animations**: Letter-by-letter bounce on "inkFlow"
- **Button Animations**: Shine effect on hover, scale on tap
- **Card Animations**: Stagger animation on load, lift on hover
- **Modal Animations**: Scale and fade entrance/exit
- **Background Animations**: Floating orbs and particles

### Responsive Design
- **Desktop**: Full sidebar, side-by-side canvas and chat
- **Tablet**: Collapsible sidebar, stacked layout option
- **Mobile**: Hamburger menu, full-screen canvas, sliding chat

### Accessibility
- Focus-visible states for keyboard navigation
- Semantic HTML structure
- ARIA labels where appropriate
- High contrast color ratios

## 🔧 Technical Details

### Key Technologies
- **React 19.2.0**: Latest React with concurrent features
- **React Router 7.9.5**: Client-side routing
- **Framer Motion 13+**: Animation library
- **STOMP over WebSocket**: Real-time communication
- **CSS Variables**: Theming and consistency

### Channel Management
Channels are managed in the `WhiteboardPage` component:
- Each channel has: `name`, `logo`, `type` (public/private)
- Default channels: general 💬, design 🎨, development 💻
- Creating a channel adds it to the list and switches to it
- WebSocket subscriptions update on channel change

### State Management
- Session data: `{ sessionName, userName, channelName }`
- Channel list stored in `WhiteboardPage` state
- Drawing events and chat messages reset on channel switch

## 🐛 Known Issues & Future Enhancements

### Current Limitations
- Channels are not persisted to backend (frontend-only)
- No user permissions for private channels
- Mobile sidebar always overlays content

### Planned Features
- Backend integration for channel persistence
- User roles and permissions
- Channel member lists
- Voice channels (similar to Discord)
- File sharing in channels
- Channel search and filtering

## 📝 Development Notes

### CSS Architecture
- BEM-like naming convention
- Component-specific CSS files
- Global variables in `:root`
- Scoped styles to avoid conflicts

### Performance Considerations
- Framer Motion optimizes animations with hardware acceleration
- React.memo could be added for Canvas and Chat components
- WebSocket reconnection logic prevents memory leaks
- Images and emojis are lightweight (no external assets)

### Code Quality
- ESLint configured via react-scripts
- PropTypes could be added for type checking
- Comments explain complex logic
- Consistent code formatting

## 📄 License

This project is part of a collaborative whiteboard application. All rights reserved.

## 🙏 Acknowledgments

- Design inspired by Discord and modern web applications
- Animations powered by Framer Motion
- Icons using emoji for simplicity and universal support

---

**Built with ❤️ using React and Framer Motion**

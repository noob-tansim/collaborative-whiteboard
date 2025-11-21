import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>⚠️ Something went wrong</h1>
            <p style={styles.message}>
              The application encountered an error. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details</summary>
                <pre style={styles.pre}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              style={styles.button}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    padding: '2rem',
    maxWidth: '500px',
    textAlign: 'center'
  },
  title: {
    color: '#d32f2f',
    marginBottom: '1rem',
    fontSize: '1.5rem'
  },
  message: {
    color: '#666',
    marginBottom: '1.5rem',
    lineHeight: '1.5'
  },
  details: {
    marginBottom: '1.5rem',
    textAlign: 'left',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    padding: '1rem',
    border: '1px solid #e0e0e0'
  },
  summary: {
    cursor: 'pointer',
    fontWeight: 'bold',
    color: '#555'
  },
  pre: {
    marginTop: '1rem',
    overflow: 'auto',
    fontSize: '0.85rem',
    color: '#d32f2f'
  },
  button: {
    backgroundColor: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  }
};

export default ErrorBoundary;

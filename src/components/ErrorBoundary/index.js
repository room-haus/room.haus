import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      info: null,
    };
  }
  static getDerivedStateFromError(error) {
    return {error};
  }

  componentDidCatch(error, info) {
    this.setState({error, info});
  }

  render() {
    const {error, info} = this.state;
    if (error) {
      return (
        <>
          <h1>{error.toString()}</h1>
          <span>{info && info.componentStack}</span>
        </>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

/**
 * Error Boundary Component for Admin App
 * 
 * Wraps the admin app with error boundary and integrates with Sentry.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';
import * as Sentry from '@sentry/react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });

    // Log to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        errorBoundary: true,
      },
    });

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Result
          status="500"
          title="500"
          subTitle="Sorry, something went wrong. Please try refreshing the page."
          extra={[
            <Button type="primary" key="retry" onClick={this.handleReset}>
              Try Again
            </Button>,
            <Button key="reload" onClick={this.handleReload}>
              Reload Page
            </Button>,
          ]}
        >
          {import.meta.env.DEV && this.state.error && (
            <div style={{ marginTop: '20px', textAlign: 'left' }}>
              <details>
                <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                  Error Details (Development Only)
                </summary>
                <pre
                  style={{
                    backgroundColor: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '12px',
                    color: '#d32f2f',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            </div>
          )}
        </Result>
      );
    }

    return this.props.children;
  }
}

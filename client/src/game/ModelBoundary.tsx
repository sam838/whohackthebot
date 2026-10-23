import { Component, type ReactNode } from "react";

/**
 * If a 3D model fails to load, show the fallback (the bean) instead of breaking
 * the whole scene (spec.md > Important Failure Modes).
 */
export class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

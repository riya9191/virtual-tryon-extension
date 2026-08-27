const styles = `
  :host {
    all: initial;
    color-scheme: light;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .tryon-panel {
    box-sizing: border-box;
    margin: 12px 0;
    max-width: 420px;
  }

  .tryon-button,
  .tryon-secondary {
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    font: inherit;
  }

  .tryon-button {
    align-items: center;
    background: #111827;
    color: #ffffff;
    display: inline-flex;
    font-size: 14px;
    font-weight: 700;
    justify-content: center;
    min-height: 40px;
    padding: 0 16px;
  }

  .tryon-button:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .tryon-result {
    background: #ffffff;
    border: 1px solid #d7dbe3;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(17, 24, 39, 0.18);
    box-sizing: border-box;
    margin-top: 10px;
    padding: 12px;
  }

  .tryon-status {
    color: #111827;
    font-size: 13px;
    line-height: 1.4;
    margin-bottom: 10px;
  }

  .tryon-image {
    border-radius: 6px;
    display: block;
    height: auto;
    max-width: 100%;
  }

  .tryon-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .tryon-secondary {
    background: #eef1f5;
    color: #111827;
    font-size: 12px;
    font-weight: 650;
    min-height: 32px;
    padding: 0 10px;
  }
`;

export default styles;


// Composer Status Prism Capsule Indicator (permanently disabled)

function removeAllStatusVials() {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  try {
    const nodes = document.querySelectorAll('.op-status-vial');
    for (const node of nodes) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }
  } catch {
    // ignore DOM cleanup error
  }
}

export function createStatusVialController() {
  function start() {
    removeAllStatusVials();
  }

  function refresh() {
    removeAllStatusVials();
  }

  function notifyStreamingChange() {
    removeAllStatusVials();
  }

  function dispose() {
    removeAllStatusVials();
  }

  return { start, refresh, notifyStreamingChange, dispose };
}

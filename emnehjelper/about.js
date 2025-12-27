// Load version from manifest
document.addEventListener('DOMContentLoaded', () => {
  const versionElement = document.getElementById('version');
  
  try {
    const manifest = chrome.runtime.getManifest();
    if (manifest && manifest.version) {
      versionElement.textContent = `v${manifest.version}`;
    } else {
      versionElement.textContent = 'v?';
    }
  } catch (error) {
    console.error('Failed to load version:', error);
    versionElement.textContent = 'v?';
  }
});

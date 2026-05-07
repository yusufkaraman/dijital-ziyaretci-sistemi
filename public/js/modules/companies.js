// Compatibility shim: company management lives in settings.js.
function openCompaniesSettings() {
  if (typeof switchSettingsTab === 'function') {
    switchSettingsTab('companies');
  }
}

window.openCompaniesSettings = openCompaniesSettings;

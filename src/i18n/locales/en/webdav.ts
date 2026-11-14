import type { TranslationSchema } from '../../types'

export const webdav: TranslationSchema['settings']['webdav'] = {
  groupTitle: 'WEBDAV CLOUD SYNC',
  serverUrl: 'Server URL',
  username: 'Username',
  password: 'Password',
  passwordPlaceholder: 'Password / Token',
  syncing: 'Syncing data...',
  lastSync: 'Last sync: ',
  notSynced: 'Not synced yet',
  syncingBtn: 'Syncing...',
  syncNowBtn: 'Sync Now',
  syncSuccess: 'Sync successful! Data merged with cloud.',
  syncFailed: 'Sync failed, please check configuration.',
  autoSync: 'Auto Sync',
  autoSyncOn: 'On',
  autoSyncOff: 'Off',
  autoSyncHintOn: 'Merges with cloud on launch and every set interval',
  autoSyncHintOff: 'Enable after filling the server URL; off = manual "Sync Now" only',
  interval15m: '15 min',
  interval30m: '30 min',
  interval1h: '1 hour',
  interval3h: '3 hours',
  providerLabel: 'Provider',
  providerNextcloud: 'Nextcloud',
  providerJianguoyun: 'Jianguoyun',
  providerSynology: 'Synology',
  providerGeneric: 'Generic',
  appPasswordHint:
    'Use an app password, not your login password (login passwords fail when two-factor authentication is enabled).',
  testButton: 'Test connection',
  testing: 'Checking...',
  testSuccess: 'Connection works. Ready to sync.',
  testFail: 'Connection failed. Follow the hints below.',
  clearCredentials: 'Clear saved credentials',
  stageAddress: 'Address',
  stageConnection: 'Connection',
  stageAuth: 'Authentication',
  stageReadWrite: 'Read and write',
  stageCleanup: 'Cleanup',
  diagnoseAuthHint:
    'Authentication failed: check the username and app password. Accounts with two-factor authentication must use an app password.',
  diagnoseTlsHint:
    'Untrusted certificate: verify the server address, or contact the server administrator.',
  diagnoseDirHint:
    'Target folder does not exist: create a BlockHabit folder on the server and try again.',
  diagnoseHttpHint:
    'Only https addresses are supported (http is blocked by the app security policy).',
  browserTestHint:
    'Connection check runs in the desktop app (the browser preview is limited by CORS).',
  copyError: 'Copy error details',
  copiedToast: 'Copied',
  cancelTest: 'Cancel test',
  testCancelled: 'Connection check cancelled',
  testCancelledCleanupFail:
    'Cancelled; the temporary file may not have been cleaned up — run the check again to clean it up.',
  rememberPassword: 'Remember password',
  rememberPasswordOn: 'Remember',
  rememberPasswordOff: "Don't remember",
  rememberPasswordHintOn:
    'The password is stored on this device (separate from your archive) so auto-sync keeps working after a restart.',
  rememberPasswordHintOff:
    'The password is kept only in memory for this run; re-enter it after restarting to sync.',
  rememberPasswordHintOs:
    'Saved in Windows Credential Manager — neither the archive nor the config file contains your password.',
  passwordStoredPlaceholder: 'Saved — leave blank to keep using it',
  passwordKeepHint: 'A password is saved. Leave blank to keep it, or type a new one to replace it.'
}

export const syncErrors: TranslationSchema['settings']['syncErrors'] = {
  noEndpoint: 'Please fill in the WebDAV server address first',
  auth: 'Authentication failed. Check your username and password',
  parse: 'Remote archive is corrupted (invalid JSON)',
  incompatible: 'Remote archive structure is incompatible with this app version',
  network: 'Network error. Check the server address and connection',
  cors: 'Blocked by cross-origin policy: in the browser preview (npm run dev), requests are subject to CORS and standard WebDAV servers (e.g. Nextcloud) do not send CORS headers by default. The desktop app uses a native HTTP channel and is not affected; retry in the desktop app, or move data with Export / Import JSON.',
  conflict: 'Sync conflict after retry. Please sync again in a moment',
  noCollection: 'WebDAV directory does not exist on the server',
  http: 'Server returned an error. Check the WebDAV path'
}

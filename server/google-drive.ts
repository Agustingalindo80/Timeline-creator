// Google Drive integration via Replit connector
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size: string | null;
  modifiedTime: string;
  createdTime: string;
}

export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = await getUncachableGoogleDriveClient();
  const result = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, size, modifiedTime, createdTime)',
    orderBy: 'name',
    pageSize: 100,
  });

  return (result.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    webViewLink: f.webViewLink || '',
    size: f.size || null,
    modifiedTime: f.modifiedTime || '',
    createdTime: f.createdTime || '',
  }));
}

export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const drive = await getUncachableGoogleDriveClient();
  const result = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, webViewLink, size, modifiedTime, createdTime',
  });

  return {
    id: result.data.id!,
    name: result.data.name!,
    mimeType: result.data.mimeType!,
    webViewLink: result.data.webViewLink || '',
    size: result.data.size || null,
    modifiedTime: result.data.modifiedTime || '',
    createdTime: result.data.createdTime || '',
  };
}

export async function getFileContent(fileId: string, mimeType: string): Promise<string | null> {
  const drive = await getUncachableGoogleDriveClient();

  try {
    if (mimeType.startsWith('application/vnd.google-apps.')) {
      let exportMimeType = 'text/plain';
      if (mimeType === 'application/vnd.google-apps.document') {
        exportMimeType = 'text/plain';
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        exportMimeType = 'text/csv';
      } else if (mimeType === 'application/vnd.google-apps.presentation') {
        exportMimeType = 'text/plain';
      }

      const result = await drive.files.export({
        fileId,
        mimeType: exportMimeType,
      }, { responseType: 'text' });

      const content = typeof result.data === 'string' ? result.data : String(result.data);
      return content.substring(0, 10000);
    }

    if (mimeType === 'text/plain' || mimeType === 'text/csv' || mimeType === 'text/markdown' || mimeType.startsWith('text/')) {
      const result = await drive.files.get({
        fileId,
        alt: 'media',
      }, { responseType: 'text' });

      const content = typeof result.data === 'string' ? result.data : String(result.data);
      return content.substring(0, 10000);
    }

    return null;
  } catch (err) {
    console.error(`Failed to read content for file ${fileId}:`, err);
    return null;
  }
}

export function extractFolderIdFromUrl(url: string): string | null {
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/drive\/[^/]*\/folders\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  if (/^[a-zA-Z0-9_-]{10,}$/.test(url)) {
    return url;
  }

  return null;
}

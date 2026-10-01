import {
  beginUpload,
  deleteTransfer,
  finishUpload,
  listUploads,
  uploadStatus,
} from '../../shared/api/source';
import { hashFile } from '../../shared/files/sha256';
import type { AttachPorts } from './attach';

/**
 * What giving a file talks to, in the editor and in Transfers alike: the API
 * for the upload, and the address each part was signed for, which answers a
 * plain PUT (#241, #242, #253).
 */
export const ATTACH_PORTS: AttachPorts = {
  begin: beginUpload,
  finish: finishUpload,
  discard: deleteTransfer,
  put: async (url, bytes) => {
    const response = await fetch(url, { method: 'PUT', body: bytes });
    if (!response.ok) throw new Error(`The store refused a part (${response.status})`);
  },
  hash: hashFile,
  open: listUploads,
  status: uploadStatus,
};

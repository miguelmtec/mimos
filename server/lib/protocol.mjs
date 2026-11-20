// The lists, limits and the signed ticket are shared with the game's API and live next to it
// (api/_lib/protocol.mjs has no dependencies). Keep the repository layout on the VM: the server
// needs server/ and api/_lib/protocol.mjs.
export * from '../../api/_lib/protocol.mjs';

/**
 * QuickNode Streams filter for Solana Devnet, Block dataset.
 * Keeps successful AND failed transactions that touch the Brace program.
 * Return null to skip empty blocks (no webhook delivery).
 *
 * Paste this into the Stream Filter Editor as the JavaScript `main` function.
 */
function main(stream) {
  const PROGRAM = 'Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC';
  const matches = [];

  function keyString(k) {
    if (typeof k === 'string') return k;
    if (k && typeof k === 'object' && typeof k.pubkey === 'string') return k.pubkey;
    return null;
  }

  function accountKeys(tx) {
    const keys = (tx.transaction && tx.transaction.message && tx.transaction.message.accountKeys) || [];
    const loaded = (tx.meta && tx.meta.loadedAddresses) || {};
    const extra = [].concat(loaded.writable || [], loaded.readonly || []);
    return keys.concat(extra).map(keyString).filter(Boolean);
  }

  function touches(tx) {
    const keys = accountKeys(tx);
    if (keys.includes(PROGRAM)) return true;
    const ixs = (tx.transaction && tx.transaction.message && tx.transaction.message.instructions) || [];
    if (ixs.some((ix) => ix.programId === PROGRAM || keys[ix.programIdIndex] === PROGRAM)) return true;
    const logs = (tx.meta && tx.meta.logMessages) || [];
    return logs.some((line) => line.indexOf(PROGRAM) !== -1);
  }

  for (const block of stream.data || []) {
    const blockTime = block.blockTime ?? null;
    for (const tx of block.transactions || []) {
      if (!touches(tx)) continue;
      const sigs = (tx.transaction && tx.transaction.signatures) || [];
      const keys = accountKeys(tx);
      matches.push({
        signature: sigs[0] || null,
        err: (tx.meta && tx.meta.err) || null,
        logMessages: (tx.meta && tx.meta.logMessages) || [],
        blockTime,
        signer: keys[0] || null,
      });
    }
  }

  return matches.length ? matches : null;
}

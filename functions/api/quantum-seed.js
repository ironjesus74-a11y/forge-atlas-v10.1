/* ============================================================
   Forge Atlas · /api/quantum-seed
   Fetches a genuine quantum random number from the ANU Quantum
   Random Number Generator (quantum vacuum fluctuations via
   homodyne detection). Falls back to CSPRNG if ANU is down.
   IBM Quantum (Qiskit Runtime) can replace this when the user
   adds an IBM_QUANTUM_TOKEN secret — same response shape.
   ============================================================ */

export async function onRequest(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const res = await fetch(
      'https://qrng.anu.edu.au/API/jsonI.php?length=8&type=uint8',
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) throw new Error('ANU QRNG returned ' + res.status);

    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) throw new Error('bad payload');

    return new Response(JSON.stringify(buildPayload(json.data, false)), { headers });

  } catch {
    // Fallback: CSPRNG — still cryptographically secure, just not quantum
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    return new Response(JSON.stringify(buildPayload(Array.from(arr), true)), { headers });
  }
}

function buildPayload(bytes, fallback) {
  const bitString = bytes.map(b => b.toString(2).padStart(8, '0')).join('');
  const groups = bitString.match(/.{1,4}/g) || [];
  const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  const seed = parseInt(hex.slice(0, 8), 16);

  return {
    ok: true,
    fallback,
    source: fallback ? 'CSPRNG fallback' : 'ANU Quantum RNG',
    method: fallback ? 'crypto.getRandomValues' : 'vacuum fluctuation · homodyne detection',
    hardware: fallback ? 'V8 crypto' : 'ANU optical bench · Canberra',
    bits: groups.slice(0, 8).join(' '),
    hex: '0x' + hex.slice(0, 8).toUpperCase(),
    seed,
    entropy_bits: 64,
    timestamp: new Date().toISOString(),
  };
}

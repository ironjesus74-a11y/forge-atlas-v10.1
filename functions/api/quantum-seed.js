/* ============================================================
   Forge Atlas · /api/quantum-seed  v10.3
   Real quantum entropy for the Swarm QENT HUD.

   Priority chain:
     1. IBM Quantum Qiskit Runtime Sampler
        — activates automatically when IBM_QUANTUM_TOKEN secret is set
        — 16-qubit Hadamard circuit → single measurement → 16 random bits
        — Backend: ibmq_qasm_simulator (free, typically <2 s)
     2. ANU Quantum RNG (Australian National University)
        — vacuum fluctuation homodyne detection · no token required
     3. CSPRNG (crypto.getRandomValues) — always works
   ============================================================ */

export async function onRequest(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  // 1. IBM Quantum (activates when secret is configured)
  const ibmToken = context.env && context.env.IBM_QUANTUM_TOKEN;
  if (ibmToken) {
    try {
      const result = await tryIBMQuantum(ibmToken);
      return new Response(JSON.stringify(result), { headers });
    } catch (_) {
      // silent fall-through to ANU
    }
  }

  // 2. ANU QRNG — truly quantum, free, no token
  try {
    const result = await tryANU();
    return new Response(JSON.stringify(result), { headers });
  } catch (_) {
    // fall-through to CSPRNG
  }

  // 3. CSPRNG fallback — always available
  return new Response(JSON.stringify(csprngPayload()), { headers });
}

// ============================================================
// SOURCE 1 · IBM Quantum Qiskit Runtime
// ============================================================
async function tryIBMQuantum(token) {
  // 16-qubit Hadamard+Measure circuit in OpenQASM 2.0.
  // 'h q;' broadcasts H gate to all 16 qubits simultaneously.
  const qasm = [
    'OPENQASM 2.0;',
    'include "qelib1.inc";',
    'qreg q[16];',
    'creg c[16];',
    'h q;',
    'measure q -> c;',
  ].join('\n');

  const sub = await fetch('https://api.quantum-computing.ibm.com/runtime/jobs', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      program_id: 'sampler',
      backend: 'ibmq_qasm_simulator',
      hub: 'ibm-q',
      group: 'open',
      project: 'main',
      params: {
        circuits: [qasm],
        circuit_indices: [0],
        shots: 1,
      },
    }),
    signal: AbortSignal.timeout(7000),
  });

  if (!sub.ok) throw new Error('IBM submit ' + sub.status);
  const submitData = await sub.json();
  const jobId = submitData.id;
  if (!jobId) throw new Error('IBM: no job id in response');

  // Poll for completion — ibmq_qasm_simulator typically finishes in <2 s
  for (let attempt = 0; attempt < 6; attempt++) {
    await delay(900);

    const pollRes = await fetch(
      'https://api.quantum-computing.ibm.com/runtime/jobs/' + jobId,
      {
        headers: { 'Authorization': 'Bearer ' + token },
        signal: AbortSignal.timeout(5000),
      }
    );
    const job = await pollRes.json();

    if (job.status === 'Completed') {
      const resRes = await fetch(
        'https://api.quantum-computing.ibm.com/runtime/jobs/' + jobId + '/results',
        {
          headers: { 'Authorization': 'Bearer ' + token },
          signal: AbortSignal.timeout(5000),
        }
      );
      const data = await resRes.json();

      // Sampler v1: quasi_dists[0] is { integer_bitstring_key: probability }
      // The key is the integer representation of the 16-bit measurement result.
      const qd = data && data.quasi_dists && data.quasi_dists[0];
      if (qd) {
        const raw = parseInt(Object.keys(qd)[0], 10);
        if (!isNaN(raw)) {
          return buildPayload(
            raw & 0xFFFF,
            'IBM Quantum',
            'ibmq_qasm_simulator · Qiskit Runtime · 16-qubit H circuit',
            false,
            'ibm'
          );
        }
      }
    }

    if (job.status === 'Failed' || job.status === 'Cancelled') {
      throw new Error('IBM job ended with status: ' + job.status);
    }
  }

  throw new Error('IBM Quantum timeout after 6 poll attempts');
}

// ============================================================
// SOURCE 2 · ANU Quantum RNG
// ============================================================
async function tryANU() {
  const res = await fetch(
    'https://qrng.anu.edu.au/API/jsonI.php?length=2&type=uint8',
    {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) throw new Error('ANU QRNG returned ' + res.status);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data) || json.data.length < 2) {
    throw new Error('ANU QRNG: unexpected payload');
  }
  // Combine two uint8 bytes into one uint16
  const entropy = ((json.data[0] << 8) | json.data[1]) & 0xFFFF;
  return buildPayload(
    entropy,
    'ANU Quantum RNG',
    'ANU optical bench · vacuum fluctuations · Canberra, Australia',
    false,
    'anu'
  );
}

// ============================================================
// SOURCE 3 · CSPRNG fallback
// ============================================================
function csprngPayload() {
  const buf = new Uint8Array(2);
  crypto.getRandomValues(buf);
  const entropy = ((buf[0] << 8) | buf[1]) & 0xFFFF;
  return buildPayload(entropy, 'CSPRNG fallback', 'crypto.getRandomValues · V8', true, 'csprng');
}

// ============================================================
// HELPERS
// ============================================================
function buildPayload(entropy16, source, hardware, fallback, sourceKey) {
  const hex = entropy16.toString(16).padStart(4, '0').toUpperCase();
  const bits = entropy16.toString(2).padStart(16, '0').match(/.{4}/g).join(' ');
  return {
    ok: true,
    fallback,
    source,
    sourceKey,
    method: fallback ? 'crypto.getRandomValues' : 'quantum measurement',
    hardware,
    bits,
    hex: '0x' + hex,
    seed: entropy16,
    entropy_bits: 16,
    timestamp: new Date().toISOString(),
  };
}

function delay(ms) {
  return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}

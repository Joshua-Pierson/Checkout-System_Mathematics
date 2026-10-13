const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');

// The only backend endpoint present in the supplied frontend.
export async function fetchInventory(signal) {
  let response;
  try {
    response = await fetch(`${baseUrl}/api/items`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not connect to Python. Check that your backend is running on port 5000 and allows CORS.');
  }
  if (!response.ok) throw new Error(`Inventory request failed (${response.status}).`);
  return response.json();
}

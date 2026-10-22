// Shared API requests: connect the front-end screens to the back-end system.


async function fetchInventory() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/items');
        if (!response.ok) throw new Error('Network topology failure');
        
        const data = await response.json();
        console.log("Inventory Payload Executed:", data);
        return data;
    } catch (error) {
        console.error("Failed to connect to Python backend:", error);
    }
}

async function createItem(item) {
    const response = await fetch(
        'http://127.0.0.1:5000/api/items',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(item)
        }
    );

    return await response.json();
}
async function updateItem(itemId, item) {
    const response = await fetch(
        `http://127.0.0.1:5000/api/items/${itemId}`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(item)
        }
    );

    return await response.json();
}
async function deleteItem(itemId) {
    const response = await fetch(
        `http://127.0.0.1:5000/api/items/${itemId}`,
        {
            method: 'DELETE'
        }
    );

    return await response.json();
}
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


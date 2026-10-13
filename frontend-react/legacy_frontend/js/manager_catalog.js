// Manager catalog UI: display items and categories, and provide controls
// to add, edit, remove, and mark them as tax exempt.

/**
 * Transforms a flat inventory array into a categorized object map.
 * @param {Array} inventoryArray - The flat JSON payload from the API.
 * @returns {Object} - e.g., { "BOOKS!": [...], "snacks": [...] }
 */
function groupItemsByCategory(inventoryArray) {
    return inventoryArray.reduce((groupedData, item) => {
        const category = item.category;
        
        // Initialize the category array if it does not exist in the map
        if (!groupedData[category]) {
            groupedData[category] = [];
        }
        
        // Push the item into its respective category bucket
        groupedData[category].push(item);
        
        return groupedData;
    }, {});
}

// Example execution to verify logic:
// const catalogData = await fetchInventory(); 
// const categorizedCatalog = groupItemsByCategory(catalogData);
// console.log(categorizedCatalog);
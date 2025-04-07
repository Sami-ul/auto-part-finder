const searchResults = document.getElementById('search-results');
const addressInput = document.getElementById('address');
let lastSearched;
let debounce;

addressInput.addEventListener('input', function() {
    const searchAddress = this.value.trim();
    if (searchAddress.length < 3 || lastSearched == searchAddress) {
        searchResults.style.display = 'none';
        return;
    }
    lastSearched=searchAddress;

    clearTimeout(debounce);
    
    debounce = setTimeout(() => {
        suggestAddresses(searchAddress);
    }, 500);
});

async function suggestAddresses(query) {
    searchResults.innerHTML = '';
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
            format: 'json',
            q: query + ', USA',
            limit: 3,
            countrycodes: 'us'
        },
    });
    
    if (response.data.length > 0) {
        for (let i = 0; i < response.data.length; i++) {
            const addressElement = response.data[i].display_name;
            const div = document.createElement('div');
            div.className = "addressResultElement";
            div.textContent = addressElement;
            
            div.addEventListener('click', function() {
                addressInput.value = addressElement;
                searchResults.style.display = 'none';
            });
            
            searchResults.appendChild(div);
        }
        
        searchResults.style.display = 'block';
    } else {
        searchResults.style.display = 'none';
    }
}
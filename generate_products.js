const fs = require('fs');

const categoriesInfo = [
    { name: 'Watches', icon: 'ph-watch', base: 1, prompt: 'luxury watch close up product shot, clean background, photorealistic' },
    { name: 'Sneakers', icon: 'ph-sneaker', base: 21, prompt: 'premium sneaker shoe product shot, clean background, highly detailed' },
    { name: 'Audio', icon: 'ph-headphones', base: 41, prompt: 'high-end audio headphones or speaker product shot, studio lighting' },
    { name: 'Eyewear', icon: 'ph-eyeglasses', base: 61, prompt: 'designer sunglasses eyewear product shot, fashion photography' },
    { name: 'Bags', icon: 'ph-bag', base: 81, prompt: 'luxury leather bag tote product shot, elegant lighting, pure background' },
    { name: 'Fragrance', icon: 'ph-drop', base: 101, prompt: 'luxury perfume bottle product shot, glass reflection, elegant' },
    { name: 'Apparel', icon: 'ph-t-shirt', base: 121, prompt: 'premium clothing apparel flat lay or mannequin, high fashion' }
];

const adjectives = ['Elite', 'Pro', 'Classic', 'Ultra', 'Premium', 'Minimal', 'Vintage', 'Modern', 'Luxe', 'Signature', 'Essential', 'Phantom', 'Heritage', 'Aero', 'Carbon', 'Nova', 'Vertex', 'Zenith', 'Summit', 'Apex'];
const nouns = {
    'Watches': ['Chronograph', 'Diver', 'Automatic', 'Timepiece', 'Aviator', 'Tourbillon', 'Quartz', 'Master', 'Skeleton', 'Lunar'],
    'Sneakers': ['Runner', 'High-Top', 'Slip-On', 'Trainer', 'Court', 'Boost', 'Strider', 'Trekker', 'Knit', 'Glider'],
    'Audio': ['Headphones', 'Earbuds', 'Speaker', 'Soundbar', 'Monitor', 'Pods', 'Over-Ear', 'Wireless', 'Acoustic', 'Bass'],
    'Eyewear': ['Aviator', 'Wayfarer', 'Clubmaster', 'Round', 'Shield', 'Cat-Eye', 'Square', 'Polarized', 'Optics', 'Frames'],
    'Bags': ['Tote', 'Satchel', 'Backpack', 'Duffel', 'Clutch', 'Briefcase', 'Messenger', 'Weekender', 'Crossbody', 'Holdall'],
    'Fragrance': ['Oud', 'Musk', 'Cologne', 'Parfum', 'Mist', 'Elixir', 'Essence', 'Aura', 'Blend', 'Nectar'],
    'Apparel': ['Jacket', 'Blazer', 'T-Shirt', 'Sweater', 'Hoodie', 'Trousers', 'Coat', 'Knitwear', 'Polo', 'Cardigan']
};

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

let products = [];
let idCounter = 1;

categoriesInfo.forEach(cat => {
    for (let i = 0; i < 20; i++) {
        const adjective = getRandomElement(adjectives);
        const noun = getRandomElement(nouns[cat.name]);
        const name = `${adjective} ${noun}`;
        
        const price = Math.floor(Math.random() * 400) + 50; // 50 to 450
        const isSale = Math.random() > 0.7;
        const salePrice = isSale ? Math.floor(price * 0.8) : null;
        
        const isNew = Math.random() > 0.8;
        const badges = [null, null, null, 'hot', 'limited'];
        let badge = getRandomElement(badges);
        if (isSale) badge = 'sale';
        if (isNew && !badge) badge = 'new';
        
        const rating = (Math.random() * 1.5 + 3.5).toFixed(1); // 3.5 to 5.0
        const reviews = Math.floor(Math.random() * 500) + 10;
        
        // Encode prompt for URL
        const specificPrompt = `${name} ${cat.prompt}`;
        const encodedPrompt = encodeURIComponent(specificPrompt);
        const seed = idCounter * 1337;
        // Using pollinations.ai for realistic images matching the prompt
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=400&height=400&nologo=true&seed=${seed}`;
        
        let sizes = ['One Size'];
        if (cat.name === 'Apparel') sizes = ['S', 'M', 'L', 'XL'];
        if (cat.name === 'Sneakers') sizes = ['8', '9', '10', '11', '12'];
        if (cat.name === 'Watches') sizes = ['38mm', '40mm', '42mm'];
        if (cat.name === 'Fragrance') sizes = ['50ml', '100ml'];

        products.push({
            id: idCounter++,
            name: name,
            price: price,
            category: cat.name,
            rating: parseFloat(rating),
            reviews: reviews,
            image: imageUrl,
            desc: `Experience the finest quality with the ${name}. Expertly crafted for the modern lifestyle.`,
            badge: badge,
            sizes: sizes,
            colors: ['#1a1a1a', '#f5f5f5', '#D4AF37'],
            isNew: isNew,
            salePrice: salePrice,
            tags: []
        });
    }
});

const categories = categoriesInfo.map(c => ({
    name: c.name,
    icon: c.icon,
    count: 20
}));

const fileContent = `// Automatically generated products data
const categories = ${JSON.stringify(categories, null, 4)};

const products = ${JSON.stringify(products, null, 4)};
`;

fs.writeFileSync('products.js', fileContent);
console.log('Successfully generated products.js with ' + products.length + ' items.');

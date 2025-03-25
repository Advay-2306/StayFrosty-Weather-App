const apiKey = '92e98dd520d12929b6c3ac2d11c12390';
const searchBtn = document.getElementById('searchBtn');
const mapBtn = document.getElementById('mapBtn');
const searchInput = document.getElementById('search');
const weatherInfo = document.getElementById('weatherInfo');
const forecastInfo = document.getElementById('forecastInfo');
const hourlyInfo = document.getElementById('hourlyInfo');
const currentWeatherSection = document.getElementById('currentWeather');
const mapModal = document.getElementById('mapModal');
const closeModal = document.querySelector('.close');
let map;
let initialWeather = [];
let initialStartDate = null;
let currentStartDate = null;
let city = '';
let forecastDataGlobal = null;
let currentTimezoneOffset = 0;

// Mapping weather conditions to background images
const weatherBackgrounds = {
    'clear_sky_night': 'weather_pics/clearnightsky.jpg',
    'clear_sky_day': 'weather_pics/clearskyday.jpg',
    'cloudy': 'weather_pics/overcastclouds.jpg',
    'light_rain': 'weather_pics/rain.jpg',
    'moderate_rain': 'weather_pics/rain.jpg',
    'heavy_rain': 'weather_pics/rain.jpg',
    'thunderstorm': 'weather_pics/thunderstorm.jpg',
    'snow': 'weather_pics/snowfall.jpg',
    'mist_haze': 'weather_pics/haze.jpg'
};

// Determine background based on weather and time
function getWeatherBackground(weatherDesc, iconCode, timezoneOffset = 0) {
    // Validate iconCode
    if (!iconCode || typeof iconCode !== 'string') {
        console.warn(`Invalid iconCode: ${iconCode}, defaulting to daytime`);
        iconCode = '01d';
    }

    // Determine day/night using iconCode
    let isDaytime = iconCode.includes('d');
    const timeOfDayFromIcon = isDaytime ? 'day' : 'night';

    // Cross-check with local time using timezone offset
    const utcTime = new Date();
    const localTime = new Date(utcTime.getTime() + (timezoneOffset * 1000));
    const localHour = localTime.getUTCHours();
    const isDaytimeFromTime = localHour >= 6 && localHour < 18;
    const timeOfDayFromTime = isDaytimeFromTime ? 'day' : 'night';

    const timeOfDay = timeOfDayFromIcon;
    if (timeOfDayFromIcon !== timeOfDayFromTime) {
        console.warn(`Day/Night mismatch: Icon (${iconCode}) says ${timeOfDayFromIcon}, but local time (${localHour}h) says ${timeOfDayFromTime}`);
    }
    
    const normalizedDesc = weatherDesc.toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace('clouds', '_clouds');
    
    console.log(`Normalized Description: ${normalizedDesc}, Time of Day: ${timeOfDay}, Icon: ${iconCode}, Local Hour: ${localHour}`);
    
    // Special handling for precipitation and extreme conditions
    if (weatherDesc.toLowerCase().includes('rain')) {
        if (weatherDesc.toLowerCase().includes('light')) return weatherBackgrounds['light_rain'];
        if (weatherDesc.toLowerCase().includes('moderate')) return weatherBackgrounds['moderate_rain'];
        if (weatherDesc.toLowerCase().includes('heavy')) return weatherBackgrounds['heavy_rain'];
        return weatherBackgrounds['light_rain'];
    }
    
    if (weatherDesc.toLowerCase().includes('thunderstorm')) {
        return weatherBackgrounds['thunderstorm'];
    }
    
    if (weatherDesc.toLowerCase().includes('snow')) {
        return weatherBackgrounds['snow'];
    }
    
    if (weatherDesc.toLowerCase().includes('mist') || weatherDesc.toLowerCase().includes('haze')) {
        return weatherBackgrounds['mist_haze'];
    }
    
    // Handle all cloud-like conditions with the same background
    if (weatherDesc.toLowerCase().includes('clouds')) {
        console.log(`Cloudy weather detected: ${weatherDesc}, using overcastclouds.jpg`);
        return weatherBackgrounds['cloudy'];
    }
    
    // Handle clear sky
    const backgroundKey = `${normalizedDesc}_${timeOfDay}`;
    const background = weatherBackgrounds[backgroundKey] || weatherBackgrounds['clear_sky_day'];
    if (!weatherBackgrounds[backgroundKey]) {
        console.warn(`Background key "${backgroundKey}" not found, falling back to clear_sky_day`);
    }
    console.log(`Weather: ${weatherDesc}, Icon: ${iconCode}, Background Path: ${background}`);
    return background;
}

// Helper function to get weather class for gradients and styling
function getWeatherClass(weatherDesc) {
    switch (weatherDesc.toLowerCase()) {
        case 'clear sky': return 'clear-sky';
        case 'few clouds': return 'few-clouds';
        case 'clouds': return 'clouds';
        case 'scattered clouds': return 'scattered-clouds';
        case 'broken clouds': return 'broken-clouds';
        case 'smoke': return 'smoke';
        case 'haze': return 'haze';
        case 'moderate rain': return 'moderate-rain';
        case 'light rain': return 'light-rain';
        case 'overcast clouds': return 'overcast-clouds';
        default: return 'default-weather';
    }
}

// Fetch weather data directly from OpenWeatherMap
async function getWeather(cityName = null, lat = null, lon = null) {
    let currentUrl, forecastUrl;
    if (cityName) {
        currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}&units=metric`;
        forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${cityName}&appid=${apiKey}&units=metric`;
    } else if (lat && lon) {
        currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
        forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    }

    try {
        const currentResponse = await fetch(currentUrl);
        if (!currentResponse.ok) throw new Error(`Current weather fetch failed: ${currentResponse.statusText}`);
        const currentData = await currentResponse.json();
        if (currentData.cod && currentData.cod !== 200) throw new Error(currentData.message);
        city = currentData.name;
        currentTimezoneOffset = currentData.timezone;
        initialStartDate = new Date();
        currentStartDate = initialStartDate;
        displayCurrentWeather(currentData, city, initialStartDate);

        const forecastResponse = await fetch(forecastUrl);
        if (!forecastResponse.ok) throw new Error(`Forecast fetch failed: ${currentResponse.statusText}`);
        const forecastData = await forecastResponse.json();
        if (forecastData.cod && forecastData.cod !== "200") throw new Error(forecastData.message);
        forecastDataGlobal = forecastData;
        initialWeather = extractInitialWeather(forecastData);
        displayForecast(initialWeather, initialStartDate, currentStartDate);
        displayHourlyWeather(forecastData, initialStartDate);
    } catch (error) {
        console.error('Error:', error);
        weatherInfo.innerHTML = `Error fetching weather data: ${error.message}`;
    }
}

// Extract initial 5-day weather
function extractInitialWeather(forecastData) {
    const dailyData = [];
    for (let i = 0; i < forecastData.list.length && dailyData.length < 5; i += 8) {
        dailyData.push(forecastData.list[i]);
    }
    return dailyData;
}

// Display current weather with background image and gradient
function displayCurrentWeather(dayData, city, date) {
    const iconUrl = `https://openweathermap.org/img/wn/${dayData.weather[0].icon}@2x.png`;
    const weatherBackground = getWeatherBackground(dayData.weather[0].description, dayData.weather[0].icon, currentTimezoneOffset);
    const weatherClass = getWeatherClass(dayData.weather[0].description);

    currentWeatherSection.style.backgroundImage = `url('${weatherBackground}')`;
    currentWeatherSection.style.backgroundSize = 'cover';
    currentWeatherSection.style.backgroundPosition = 'center';

    document.body.classList.remove('clear-sky', 'few-clouds', 'clouds', 'scattered-clouds', 
        'broken-clouds', 'smoke', 'haze', 'moderate-rain', 'light-rain', 'overcast-clouds', 'default-weather');
    document.body.classList.add(weatherClass);

    let gradient;
    const weatherDesc = dayData.weather[0].description.toLowerCase();
    const isDaytime = dayData.weather[0].icon.includes('d');

    switch (weatherDesc) {
        case 'clear sky':
            if (isDaytime) {
                gradient = 'linear-gradient(135deg,rgb(104, 173, 238), rgb(75, 214, 158))';
            } else {
                gradient = 'linear-gradient(135deg, #1B263B, #415A77)';
            }
            break;
        case 'few clouds':
        case 'clouds':
        case 'scattered clouds':
        case 'broken clouds':
        case 'overcast clouds':
            gradient = 'linear-gradient(135deg,rgb(206, 209, 214),rgb(74, 99, 119))';
            break;
        case 'smoke':
            gradient = 'linear-gradient(135deg, #696969, #A9A9A9)';
            break;
        case 'haze':
            gradient = 'linear-gradient(135deg, #5D6D7E, #A9A9A9)';
            break;
        case 'moderate rain':
            gradient = 'linear-gradient(135deg, #4682B4, #1E90FF)';
            break;
        case 'light rain':
            gradient = 'linear-gradient(135deg, #ADD8E6, #87CEEB)';
            break;
        default:
            gradient = 'linear-gradient(135deg, #87CEEB, #4682B4)';
    }
    document.body.style.background = gradient;

    weatherInfo.innerHTML = `
        <h3>${city} - ${date.toLocaleDateString()}</h3>
        <img src="${iconUrl}" alt="${dayData.weather[0].description}" class="weather-icon">
        <p>Temperature: ${dayData.main.temp}°C</p>
        <p>Condition: ${dayData.weather[0].description}</p>
        <p>Humidity: ${dayData.main.humidity}%</p>
        <p>Wind: ${dayData.wind.speed} m/s</p>`;
}

// Display 5-day forecast with background images
function displayForecast(initialWeather, initialStartDate, currentStartDate) {
    forecastInfo.innerHTML = '';
    const offsetDays = Math.floor((currentStartDate - initialStartDate) / (1000 * 60 * 60 * 24));
    for (let j = 0; j < 5; j++) {
        const dayIndex = (offsetDays + j) % 5;
        const weather = initialWeather[dayIndex];
        const date = new Date(currentStartDate.getTime() + j * 24 * 60 * 60 * 1000);
        const iconUrl = `https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`;
        const weatherBackground = getWeatherBackground(weather.weather[0].description, weather.weather[0].icon, currentTimezoneOffset);
        const weatherClass = getWeatherClass(weather.weather[0].description);
        
        forecastInfo.innerHTML += `
            <div class="forecast-day ${weatherClass}" data-date="${date.toISOString()}" 
                 style="background-image: url('${weatherBackground}'); 
                        background-size: cover; 
                        background-position: center;">
                <p>${date.toLocaleDateString()}</p>
                <img src="${iconUrl}" alt="${weather.weather[0].description}" class="weather-icon">
                <p>Temp: ${weather.main.temp.toFixed(1)}°C</p>
                <p>${weather.weather[0].description}</p>
            </div>
        `;
    }
}

// Display hourly weather with background images
function displayHourlyWeather(forecastData, targetDate) {
    hourlyInfo.innerHTML = '';
    const totalHours = forecastData.list.length;
    const hoursPerDay = 8;
    const offsetDays = Math.floor((targetDate - initialStartDate) / (1000 * 60 * 60 * 24));
    const startIndex = (offsetDays * hoursPerDay) % totalHours;

    for (let i = 0; i < hoursPerDay; i++) {
        const hourIndex = (startIndex + i) % totalHours;
        const hour = forecastData.list[hourIndex];
        const baseTime = new Date(targetDate.getTime());
        const hourOffset = i * 3 * 60 * 60 * 1000;
        const hourDate = new Date(baseTime.getTime() + hourOffset);
        const iconUrl = `https://openweathermap.org/img/wn/${hour.weather[0].icon}.png`;
        const weatherBackground = getWeatherBackground(hour.weather[0].description, hour.weather[0].icon, currentTimezoneOffset);
        const weatherClass = getWeatherClass(hour.weather[0].description);
        
        hourlyInfo.innerHTML += `
            <div class="hourly-item ${weatherClass}" 
                 style="background-image: url('${weatherBackground}'); 
                        background-size: cover; 
                        background-position: center;">
                <p>${hourDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <img src="${iconUrl}" alt="${hour.weather[0].description}">
                <p>${hour.main.temp.toFixed(1)}°C</p>
                <p>${hour.weather[0].description}</p>
            </div>`;
    }
}

// Click listener for forecast days
forecastInfo.addEventListener('click', (e) => {
    const forecastDay = e.target.closest('.forecast-day');
    if (forecastDay) {
        const dateStr = forecastDay.getAttribute('data-date');
        currentStartDate = new Date(dateStr);
        const offsetDays = Math.floor((currentStartDate - initialStartDate) / (1000 * 60 * 60 * 24));
        const dayIndex = offsetDays % 5;
        const dayData = initialWeather[dayIndex];
        displayCurrentWeather(dayData, city, currentStartDate);
        displayForecast(initialWeather, initialStartDate, currentStartDate);
        displayHourlyWeather(forecastDataGlobal, currentStartDate);
    }
});

// Initialize map
function initMap(lat = 51.505, lon = -0.09) {
    map = L.map('map').setView([lat, lon], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        await getWeather(null, lat, lng);
        mapModal.style.display = 'none';
    });
}

// Event listeners for search and map functionality
searchBtn.addEventListener('click', () => {
    const city = searchInput.value.trim();
    if (city) {
        getWeather(city);
    }
});

mapBtn.addEventListener('click', () => {
    mapModal.style.display = 'block';
    if (!map) initMap();
});

closeModal.addEventListener('click', () => mapModal.style.display = 'none');

// Get user's location on load
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        await getWeather(null, latitude, longitude);
    }, (error) => {
        console.error('Geolocation error:', error);
        weatherInfo.innerHTML = 'Could not get your location. Please search for a city.';
    });
}

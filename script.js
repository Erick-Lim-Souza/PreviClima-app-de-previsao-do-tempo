        class WeatherApp {
            constructor() {
                this.currentLocation = {
                    city: 'Goiânia',
                    state: 'GO',
                    latitude: -16.6799,
                    longitude: -49.255
                };
                this.hourlyData = [];
                this.forecastData = [];
                this.extendedForecastData = [];
                this.userPreferences = this.loadPreferences();
                this.searchHistory = this.loadSearchHistory();
                this.isOnline = navigator.onLine;
                this.currentWeatherData = null;
                this.forceRefresh = false;
                this.deferredPrompt = null;
                this.init();
            }

            init() {
                this.applyTheme();
                this.setupEventListeners();
                this.setupPeriodicUpdates();
                this.setupPWA();
                this.getGeolocation();
                this.updateTime();
                this.updateSearchHistory();
                this.checkOnlineStatus();
                setInterval(() => this.updateTime(), 60000);
            }

            setupEventListeners() {
                // Busca de cidades
                const cityInput = document.getElementById('cityInput');
                cityInput.addEventListener('input', (e) => this.handleSearchInput(e));
                cityInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.performSearch(e.target.value.trim());
                    }
                });

                // Configurações
                document.getElementById('settingsBtn').addEventListener('click', () => this.toggleSettings());
                document.getElementById('themeToggle').addEventListener('change', (e) => this.toggleTheme(e));
                document.getElementById('unitToggle').addEventListener('change', (e) => this.toggleUnit(e));
                document.getElementById('rainAlertsToggle').addEventListener('change', (e) => this.updateAlertPreference('rain', e.target.checked));
                document.getElementById('heatAlertsToggle').addEventListener('change', (e) => this.updateAlertPreference('heat', e.target.checked));

                // Abas
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        e.target.classList.add('active');
                        this.updateChart(e.target.dataset.tab);
                    });
                });

                // Detecção de conexão
                window.addEventListener('online', () => this.handleOnlineStatus(true));
                window.addEventListener('offline', () => this.handleOnlineStatus(false));

                // Fechar sugestões ao clicar fora
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.search-container')) {
                        this.hideSuggestions();
                    }
                });
            }

            setupPWA() {
                // Verificar se o navegador suporta PWA
                if ('serviceWorker' in navigator) {
                    window.addEventListener('load', () => {
                        navigator.serviceWorker.register('/sw.js')
                            .then((registration) => {
                                console.log('SW registered: ', registration);
                            })
                            .catch((registrationError) => {
                                console.log('SW registration failed: ', registrationError);
                            });
                    });
                }

                // Evento para instalação do PWA
                window.addEventListener('beforeinstallprompt', (e) => {
                    e.preventDefault();
                    this.deferredPrompt = e;
                    this.showInstallButton();
                });

                // Botão de instalação
                document.getElementById('installBtn').addEventListener('click', () => {
                    this.installPWA();
                });

                // Verificar se já está instalado
                window.addEventListener('appinstalled', () => {
                    this.hideInstallButton();
                    console.log('PWA foi instalado');
                });
            }

            showInstallButton() {
                const installBtn = document.getElementById('installBtn');
                installBtn.style.display = 'block';
            }

            hideInstallButton() {
                const installBtn = document.getElementById('installBtn');
                installBtn.style.display = 'none';
            }

            async installPWA() {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    const { outcome } = await this.deferredPrompt.userChoice;
                    
                    if (outcome === 'accepted') {
                        console.log('Usuário aceitou a instalação');
                    } else {
                        console.log('Usuário recusou a instalação');
                    }
                    
                    this.deferredPrompt = null;
                    this.hideInstallButton();
                }
            }

            async handleSearchInput(e) {
                const query = e.target.value.trim();
                if (query.length < 2) {
                    this.hideSuggestions();
                    return;
                }

                try {
                    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=pt&format=json`);
                    const data = await response.json();
                    
                    if (data.results && data.results.length > 0) {
                        this.showSuggestions(data.results);
                    } else {
                        this.hideSuggestions();
                    }
                } catch (error) {
                    console.warn('Erro ao buscar sugestões:', error);
                    this.hideSuggestions();
                }
            }

            showSuggestions(results) {
                const container = document.getElementById('searchSuggestions');
                container.innerHTML = results.map(city => 
                    `<div class="suggestion-item" data-lat="${city.latitude}" data-lon="${city.longitude}">
                        ${city.name}${city.admin1 ? ', ' + city.admin1 : ''}
                    </div>`
                ).join('');
                
                container.style.display = 'block';
                
                container.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        this.currentLocation = {
                            city: item.textContent.split(',')[0],
                            state: item.textContent.split(',')[1]?.trim() || '',
                            latitude: parseFloat(item.dataset.lat),
                            longitude: parseFloat(item.dataset.lon)
                        };
                        document.getElementById('cityInput').value = '';
                        this.hideSuggestions();
                        this.addToSearchHistory(this.currentLocation.city);
                        this.loadWeatherData();
                    });
                });
            }

            hideSuggestions() {
                document.getElementById('searchSuggestions').style.display = 'none';
            }

            async performSearch(cityName) {
                if (!cityName) return;
                
                this.showLoading(`Buscando ${cityName}...`);
                
                try {
                    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=pt&format=json`);
                    const data = await response.json();
                    
                    if (data.results && data.results.length > 0) {
                        const location = data.results[0];
                        this.currentLocation = {
                            city: location.name,
                            state: location.admin1 || '',
                            latitude: location.latitude,
                            longitude: location.longitude
                        };
                        
                        this.addToSearchHistory(cityName);
                        this.loadWeatherData();
                    } else {
                        this.showError('Cidade não encontrada');
                    }
                } catch (error) {
                    this.showError('Erro ao buscar cidade');
                }
            }

            async getGeolocation() {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        async (position) => {
                            this.currentLocation.latitude = position.coords.latitude;
                            this.currentLocation.longitude = position.coords.longitude;
                            
                            try {
                                const locationName = await this.getLocationName(this.currentLocation.latitude, this.currentLocation.longitude);
                                if (locationName) {
                                    this.currentLocation.city = locationName;
                                }
                            } catch (error) {
                                console.warn('Não foi possível identificar a cidade automaticamente.');
                            }
                            
                            this.loadWeatherData();
                        },
                        (error) => {
                            console.warn('Usuário negou acesso à localização ou ocorreu um erro.');
                            this.loadWeatherData();
                        },
                        {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 60000
                        }
                    );
                } else {
                    this.loadWeatherData();
                }
            }

            async getLocationName(lat, lon) {
                try {
                    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`);
                    const data = await response.json();
                    return data.city || data.locality || 'Localização desconhecida';
                } catch (error) {
                    console.warn('Erro no reverse geocoding:', error);
                    return 'Localização atual';
                }
            }

            async loadWeatherData() {
                this.showLoading('Carregando dados meteorológicos...');
                
                const cacheKey = `${this.currentLocation.latitude},${this.currentLocation.longitude}`;
                const cachedData = this.getCachedData(cacheKey);
                
                if (cachedData && !this.forceRefresh) {
                    this.processWeatherData(cachedData);
                    this.hideLoading();
                    return;
                }
                
                try {
                    const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.currentLocation.latitude}&longitude=${this.currentLocation.longitude}&hourly=temperature_2m,precipitation_probability,weather_code,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current_weather=true&timezone=auto&forecast_days=14`;
                    
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    
                    const data = await response.json();
                    
                    this.setCachedData(cacheKey, data);
                    this.currentWeatherData = data;
                    this.processWeatherData(data);
                    this.hideLoading();
                    this.forceRefresh = false;
                } catch (error) {
                    console.error('Erro ao carregar dados:', error);
                    this.showError('Erro ao carregar dados meteorológicos. Verifique sua conexão.');
                    this.hideLoading();
                }
            }

            processWeatherData(data) {
                if (!data || !data.current_weather) {
                    this.showError('Dados meteorológicos inválidos recebidos.');
                    return;
                }

                const currentWeather = data.current_weather;
                this.updateCurrentWeather(currentWeather, data.hourly);
                this.processHourlyData(data.hourly, currentWeather);
                this.processDailyData(data.daily);
                this.processExtendedForecast(data.daily);
                this.updateChart('temperatura');
                this.updateAlerts(data.daily);
                document.getElementById('locationName').textContent = this.currentLocation.city;
            }

            updateCurrentWeather(currentWeather, hourly) {
                let temp = currentWeather.temperature;
                if (this.userPreferences.unit === 'fahrenheit') {
                    temp = (temp * 9/5) + 32;
                }
                
                document.getElementById('currentTemp').textContent = `${Math.round(temp)}°`;
                document.getElementById('currentIcon').textContent = this.getWeatherEmoji(currentWeather.weathercode);
                document.getElementById('condition').textContent = this.getConditionText(currentWeather.weathercode);
                document.getElementById('windSpeed').textContent = `${Math.round(currentWeather.windspeed * 3.6)} km/h`;
                
                if (hourly && hourly.precipitation_probability && hourly.precipitation_probability.length > 0) {
                    document.getElementById('rainChance').textContent = `${hourly.precipitation_probability[0]}%`;
                }
                
                if (hourly && hourly.relative_humidity_2m && hourly.relative_humidity_2m.length > 0) {
                    document.getElementById('humidity').textContent = `${hourly.relative_humidity_2m[0]}%`;
                } else {
                    document.getElementById('humidity').textContent = '--%';
                }
            }

            processHourlyData(hourly, currentWeather) {
                this.hourlyData = [];
                if (!hourly || !hourly.time) return;
                
                const now = new Date();
                const currentHour = now.getHours();
                
                for (let i = 0; i < 8; i++) {
                    const hourIndex = currentHour + i;
                    if (hourIndex < hourly.time.length) {
                        this.hourlyData.push({
                            time: (currentHour + i) % 24,
                            temp: hourly.temperature_2m[hourIndex],
                            rain: hourly.precipitation_probability[hourIndex],
                            wind: currentWeather?.windspeed ? currentWeather.windspeed * 3.6 : 0
                        });
                    }
                }
            }

            processDailyData(daily) {
                this.forecastData = [];
                if (!daily || !daily.time) return;

                const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

                for (let i = 0; i < Math.min(7, daily.time.length); i++) {
                    const dateObj = new Date(daily.time[i]);
                    const dayName = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayNames[dateObj.getDay()];
                    const dateFormatted = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}`;
                    
                    let high = daily.temperature_2m_max[i];
                    let low = daily.temperature_2m_min[i];
                    
                    if (this.userPreferences.unit === 'fahrenheit') {
                        high = (high * 9/5) + 32;
                        low = (low * 9/5) + 32;
                    }
                    
                    this.forecastData.push({
                        day: `${dayName} (${dateFormatted})`,
                        icon: this.getWeatherEmoji(daily.weather_code[i]),
                        high: Math.round(high),
                        low: Math.round(low)
                    });
                }
                
                this.updateForecast();
            }

            processExtendedForecast(dailyData) {
                this.extendedForecastData = [];
                if (!dailyData || !dailyData.time) return;
                
                const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                
                for (let i = 0; i < Math.min(14, dailyData.time.length); i++) {
                    const dateObj = new Date(dailyData.time[i]);
                    const dayName = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayNames[dateObj.getDay()];
                    const dateFormatted = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}`;
                    
                    let high = dailyData.temperature_2m_max[i];
                    let low = dailyData.temperature_2m_min[i];
                    
                    if (this.userPreferences.unit === 'fahrenheit') {
                        high = (high * 9/5) + 32;
                        low = (low * 9/5) + 32;
                    }
                    
                    this.extendedForecastData.push({
                        day: `${dayName} (${dateFormatted})`,
                        icon: this.getWeatherEmoji(dailyData.weather_code[i]),
                        high: Math.round(high),
                        low: Math.round(low),
                        rain: dailyData.precipitation_probability_max[i] || 0
                    });
                }
            }

            updateChart(type) {
                if (type === '14dias') {
                    document.getElementById('hourlyChart').style.display = 'none';
                    document.getElementById('extendedForecast').style.display = 'grid';
                    this.renderExtendedForecast();
                    return;
                } else {
                    document.getElementById('hourlyChart').style.display = 'block';
                    document.getElementById('extendedForecast').style.display = 'none';
                }
                
                const svg = document.getElementById('temperatureChart');
                const timeLabels = document.getElementById('timeLabels');
                
                if (!this.hourlyData.length) {
                    this.createMockChart(svg, timeLabels, type);
                    return;
                }

                svg.innerHTML = '';
                timeLabels.innerHTML = '';

                const width = svg.clientWidth || 700;
                const height = 80;
                const padding = 20;

                let dataPoints = [];
                let unit = '';
                
                switch(type) {
                    case 'temperatura':
                        dataPoints = this.hourlyData.map(d => d.temp);
                        unit = '°';
                        break;
                    case 'chuva':
                        dataPoints = this.hourlyData.map(d => d.rain);
                        unit = '%';
                        break;
                    case 'vento':
                        dataPoints = this.hourlyData.map(d => d.wind);
                        unit = 'km/h';
                        break;
                }

                const maxVal = Math.max(...dataPoints);
                const minVal = Math.min(...dataPoints);
                const range = maxVal - minVal || 1;

                let pathData = '';
                const stepX = (width - padding * 2) / (dataPoints.length - 1);

                dataPoints.forEach((value, index) => {
                    const x = padding + index * stepX;
                    const y = height - padding - ((value - minVal) / range) * (height - padding * 2);
                    
                    if (index === 0) {
                        pathData += `M ${x} ${y}`;
                    } else {
                        pathData += ` L ${x} ${y}`;
                    }

                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', x);
                    circle.setAttribute('cy', y);
                    circle.setAttribute('r', 3);
                    circle.setAttribute('fill', '#f39c12');
                    svg.appendChild(circle);

                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', x);
                    text.setAttribute('y', y - 10);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('fill', 'white');
                    text.setAttribute('font-size', '12');
                    text.textContent = Math.round(value) + unit;
                    svg.appendChild(text);
                });

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', pathData);
                path.setAttribute('stroke', '#f39c12');
                path.setAttribute('stroke-width', 2);
                path.setAttribute('fill', 'none');
                svg.appendChild(path);

                this.hourlyData.forEach((data, index) => {
                    const timeLabel = document.createElement('div');
                    timeLabel.textContent = `${data.time.toString().padStart(2, '0')}:00`;
                    timeLabels.appendChild(timeLabel);
                });
            }

            createMockChart(svg, timeLabels, type) {
                svg.innerHTML = '';
                timeLabels.innerHTML = '';
                
                const width = svg.clientWidth || 700;
                const height = 80;
                const padding = 20;
                
                let dataPoints = [];
                let unit = '';
                
                switch(type) {
                    case 'temperatura':
                        dataPoints = [22, 24, 26, 28, 26, 24, 22, 20];
                        unit = '°';
                        break;
                    case 'chuva':
                        dataPoints = [10, 20, 30, 40, 30, 20, 10, 5];
                        unit = '%';
                        break;
                    case 'vento':
                        dataPoints = [5, 8, 12, 15, 12, 8, 5, 3];
                        unit = 'km/h';
                        break;
                }
                
                const maxVal = Math.max(...dataPoints);
                const minVal = Math.min(...dataPoints);
                const range = maxVal - minVal || 1;
                
                let pathData = '';
                const stepX = (width - padding * 2) / (dataPoints.length - 1);
                
                dataPoints.forEach((value, index) => {
                    const x = padding + index * stepX;
                    const y = height - padding - ((value - minVal) / range) * (height - padding * 2);
                    
                    if (index === 0) {
                        pathData += `M ${x} ${y}`;
                    } else {
                        pathData += ` L ${x} ${y}`;
                    }
                    
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', x);
                    circle.setAttribute('cy', y);
                    circle.setAttribute('r', 3);
                    circle.setAttribute('fill', '#f39c12');
                    svg.appendChild(circle);
                    
                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', x);
                    text.setAttribute('y', y - 10);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('fill', 'white');
                    text.setAttribute('font-size', '12');
                    text.textContent = Math.round(value) + unit;
                    svg.appendChild(text);
                });
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', pathData);
                path.setAttribute('stroke', '#f39c12');
                path.setAttribute('stroke-width', 2);
                path.setAttribute('fill', 'none');
                svg.appendChild(path);
                
                for (let i = 0; i < 8; i++) {
                    const timeLabel = document.createElement('div');
                    timeLabel.textContent = `${(i * 3).toString().padStart(2, '0')}:00`;
                    timeLabels.appendChild(timeLabel);
                }
            }

            renderExtendedForecast() {
                const container = document.getElementById('extendedForecast');
                container.innerHTML = '';
                
                if (!this.extendedForecastData.length) {
                    this.createMockExtendedForecast(container);
                    return;
                }
                
                this.extendedForecastData.forEach(day => {
                    const item = document.createElement('div');
                    item.className = 'extended-item';
                    item.innerHTML = `
                        <div class="day">${day.day}</div>
                        <div class="forecast-icon">${day.icon}</div>
                        <div class="temps">
                            <span class="temp-high">${day.high}°</span> / 
                            <span class="temp-low">${day.low}°</span>
                        </div>
                        <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">${day.rain}%</div>
                    `;
                    container.appendChild(item);
                });
            }

            createMockExtendedForecast(container) {
                const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                const icons = ['☀️', '🌤️', '⛅', '☁️', '🌧️', '⛈️', '🌦️'];
                
                for (let i = 0; i < 14; i++) {
                    const today = new Date();
                    const futureDate = new Date(today);
                    futureDate.setDate(today.getDate() + i);
                    const dateFormatted = `${String(futureDate.getDate()).padStart(2,'0')}/${String(futureDate.getMonth()+1).padStart(2,'0')}`;
                    const dayName = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayNames[futureDate.getDay()];
                    
                    const high = 20 + Math.floor(Math.random() * 15);
                    const low = high - 5 - Math.floor(Math.random() * 5);
                    const rain = Math.floor(Math.random() * 30);
                    
                    const item = document.createElement('div');
                    item.className = 'extended-item';
                    item.innerHTML = `
                        <div class="day">${dayName} (${dateFormatted})</div>
                        <div class="forecast-icon">${icons[i % icons.length]}</div>
                        <div class="temps">
                            <span class="temp-high">${high}°</span> / 
                            <span class="temp-low">${low}°</span>
                        </div>
                        <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">${rain}%</div>
                    `;
                    container.appendChild(item);
                }
            }

            updateForecast() {
                const forecastGrid = document.getElementById('forecastGrid');
                forecastGrid.innerHTML = '';

                if (!this.forecastData.length) {
                    this.createMockForecast(forecastGrid);
                    return;
                }

                this.forecastData.forEach(day => {
                    const forecastItem = document.createElement('div');
                    forecastItem.className = 'forecast-item';
                    forecastItem.innerHTML = `
                        <div class="day">${day.day}</div>
                        <div class="forecast-icon">${day.icon}</div>
                        <div class="temps">
                            <span class="temp-high">${day.high}°</span>
                            <span class="temp-low">${day.low}°</span>
                        </div>
                    `;
                    forecastGrid.appendChild(forecastItem);
                });
            }

            createMockForecast(container) {
                const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                const icons = ['☀️', '🌤️', '⛅', '☁️', '🌧️', '⛈️', '🌦️'];
                
                for (let i = 0; i < 7; i++) {
                    const today = new Date();
                    const futureDate = new Date(today);
                    futureDate.setDate(today.getDate() + i);
                    const dateFormatted = `${String(futureDate.getDate()).padStart(2,'0')}/${String(futureDate.getMonth()+1).padStart(2,'0')}`;
                    const dayName = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayNames[futureDate.getDay()];
                    
                    const high = 20 + Math.floor(Math.random() * 15);
                    const low = high - 5 - Math.floor(Math.random() * 5);
                    
                    const forecastItem = document.createElement('div');
                    forecastItem.className = 'forecast-item';
                    forecastItem.innerHTML = `
                        <div class="day">${dayName} (${dateFormatted})</div>
                        <div class="forecast-icon">${icons[i]}</div>
                        <div class="temps">
                            <span class="temp-high">${high}°</span>
                            <span class="temp-low">${low}°</span>
                        </div>
                    `;
                    container.appendChild(forecastItem);
                }
            }

            updateAlerts(dailyData) {
                const alertsContainer = document.getElementById('alertsContainer');
                alertsContainer.innerHTML = '';

                if (!dailyData || !dailyData.precipitation_probability_max) return;

                const alerts = [];
                
                if (this.userPreferences.rainAlerts) {
                    const precipitation = dailyData.precipitation_probability_max || [];
                    const maxPrecipitation = Math.max(...precipitation);
                    
                    if (maxPrecipitation > 70) {
                        alerts.push({
                            title: 'Alerta de Chuva Forte',
                            description: `Probabilidade de chuva de ${maxPrecipitation}% nos próximos dias. Prepare-se para possíveis alagamentos.`,
                            type: 'high'
                        });
                    } else if (maxPrecipitation > 40) {
                        alerts.push({
                            title: 'Possibilidade de Chuva',
                            description: `Chuva moderada esperada (${maxPrecipitation}%). Leve um guarda-chuva ao sair.`,
                            type: 'warning'
                        });
                    }
                }
                
                if (this.userPreferences.heatAlerts) {
                    const tempsMax = dailyData.temperature_2m_max || [];
                    const maxTemp = Math.max(...tempsMax);
                    
                    if (maxTemp > 35) {
                        alerts.push({
                            title: 'Alerta de Calor',
                            description: `Temperatura máxima prevista: ${Math.round(maxTemp)}°C. Mantenha-se hidratado e evite exposição prolongada ao sol.`,
                            type: 'warning'
                        });
                    }
                }
                
                const tempsMin = dailyData.temperature_2m_min || [];
                const minTemp = Math.min(...tempsMin);
                if (minTemp < 10) {
                    alerts.push({
                        title: 'Alerta de Frio',
                        description: `Temperatura mínima prevista: ${Math.round(minTemp)}°C. Vista-se adequadamente para o frio.`,
                        type: 'warning'
                    });
                }

                alerts.forEach(alert => {
                    const alertElement = document.createElement('div');
                    alertElement.className = `alert ${alert.type === 'warning' ? 'warning' : ''}`;
                    alertElement.innerHTML = `
                        <div class="alert-title">${alert.title}</div>
                        <div class="alert-description">${alert.description}</div>
                    `;
                    alertsContainer.appendChild(alertElement);
                });
            }

            getWeatherEmoji(weatherCode) {
                const emojis = {
                    '0': '☀️', '1': '🌤️', '2': '⛅', '3': '☁️',
                    '45': '🌫️', '48': '🌫️', '51': '🌦️', '53': '🌦️',
                    '55': '🌦️', '56': '🌧️', '57': '🌧️', '61': '🌧️',
                    '63': '🌧️', '65': '🌧️', '66': '🌧️', '67': '🌧️',
                    '71': '🌨️', '73': '🌨️', '75': '🌨️', '77': '🌨️',
                    '80': '🌦️', '81': '🌦️', '82': '🌦️', '85': '🌨️',
                    '86': '🌨️', '95': '⛈️', '96': '⛈️', '99': '⛈️'
                };
                return emojis[weatherCode.toString()] || '☀️';
            }

            getConditionText(weatherCode) {
                const conditions = {
                    '0': 'Céu limpo', '1': 'Poucas nuvens', '2': 'Parcialmente nublado', '3': 'Nublado',
                    '45': 'Neblina', '48': 'Neblina com geada', '51': 'Chuvisco leve', '53': 'Chuvisco moderado',
                    '55': 'Chuvisco intenso', '56': 'Chuvisco congelante leve', '57': 'Chuvisco congelante intenso',
                    '61': 'Chuva leve', '63': 'Chuva moderada', '65': 'Chuva forte', '66': 'Chuva congelante leve',
                    '67': 'Chuva congelante forte', '71': 'Queda de neve leve', '73': 'Queda de neve moderada',
                    '75': 'Queda de neve forte', '77': 'Grãos de neve', '80': 'Pancadas de chuva leves',
                    '81': 'Pancadas de chuva moderadas', '82': 'Pancadas de chuva violentas', '85': 'Pancadas de neve leves',
                    '86': 'Pancadas de neve fortes', '95': 'Tempestade', '96': 'Tempestade com granizo leve',
                    '99': 'Tempestade com granizo forte'
                };
                return conditions[weatherCode.toString()] || 'Condição desconhecida';
            }

            getCachedData(key) {
                const cached = localStorage.getItem(`weather_${key}`);
                if (!cached) return null;
                
                const { data, timestamp } = JSON.parse(cached);
                const now = Date.now();
                const isExpired = now - timestamp > 15 * 60 * 1000;
                
                return isExpired ? null : data;
            }

            setCachedData(key, data) {
                const cacheItem = {
                    data,
                    timestamp: Date.now()
                };
                localStorage.setItem(`weather_${key}`, JSON.stringify(cacheItem));
            }

            loadPreferences() {
                const saved = localStorage.getItem('weatherPreferences');
                return saved ? JSON.parse(saved) : {
                    theme: 'dark',
                    unit: 'celsius',
                    rainAlerts: true,
                    heatAlerts: true
                };
            }

            savePreferences() {
                localStorage.setItem('weatherPreferences', JSON.stringify(this.userPreferences));
            }

            applyTheme() {
                document.body.setAttribute('data-theme', this.userPreferences.theme);
                document.getElementById('themeToggle').checked = this.userPreferences.theme === 'light';
            }

            toggleTheme(e) {
                this.userPreferences.theme = e.target.checked ? 'light' : 'dark';
                this.applyTheme();
                this.savePreferences();
            }

            toggleUnit(e) {
                this.userPreferences.unit = e.target.checked ? 'fahrenheit' : 'celsius';
                this.savePreferences();
                if (this.currentWeatherData) {
                    this.updateWeatherDisplay();
                }
            }

            updateWeatherDisplay() {
                if (this.currentWeatherData) {
                    this.updateCurrentWeather(this.currentWeatherData.current_weather, this.currentWeatherData.hourly);
                    this.processDailyData(this.currentWeatherData.daily);
                    this.processExtendedForecast(this.currentWeatherData.daily);
                    this.updateChart(document.querySelector('.tab.active').dataset.tab);
                }
            }

            updateAlertPreference(type, enabled) {
                this.userPreferences[`${type}Alerts`] = enabled;
                this.savePreferences();
                if (this.currentWeatherData) {
                    this.updateAlerts(this.currentWeatherData.daily);
                }
            }

            loadSearchHistory() {
                const history = localStorage.getItem('searchHistory');
                return history ? JSON.parse(history) : [];
            }

            saveSearchHistory() {
                localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
            }

            addToSearchHistory(city) {
                if (!this.searchHistory.includes(city)) {
                    this.searchHistory.unshift(city);
                    this.searchHistory = this.searchHistory.slice(0, 10);
                    this.saveSearchHistory();
                    this.updateSearchHistory();
                }
            }

            updateSearchHistory() {
                const container = document.getElementById('historyList');
                container.innerHTML = this.searchHistory.map(city => 
                    `<div class="history-item" onclick="weatherApp.performSearch('${city}')">${city}</div>`
                ).join('');
            }

            checkOnlineStatus() {
                this.isOnline = navigator.onLine;
                this.handleOnlineStatus(this.isOnline);
            }

            handleOnlineStatus(online) {
                this.isOnline = online;
                const indicator = document.getElementById('offlineIndicator');
                
                if (online) {
                    indicator.style.display = 'none';
                    this.forceRefresh = true;
                    this.loadWeatherData();
                } else {
                    indicator.style.display = 'block';
                    this.showError('Sem conexão. Dados podem estar desatualizados.', 'warning');
                }
            }

            setupPeriodicUpdates() {
                setInterval(() => {
                    if (this.isOnline) {
                        this.forceRefresh = true;
                        this.loadWeatherData();
                    }
                }, 30 * 60 * 1000);
            }

            showLoading(message = 'Carregando dados meteorológicos...') {
                document.getElementById('loadingMessage').textContent = message;
                document.getElementById('loading').style.display = 'flex';
                document.getElementById('weatherContent').style.opacity = '0.5';
            }

            hideLoading() {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('weatherContent').style.opacity = '1';
            }

            toggleSettings() {
                const panel = document.getElementById('settingsPanel');
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }

            updateTime() {
                const now = new Date();
                const timeString = now.toLocaleString('pt-BR', {
                    weekday: 'long',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                document.getElementById('currentTime').textContent = timeString;
            }

            showError(message, type = 'error') {
                const errorDiv = document.getElementById('error');
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
                errorDiv.className = type === 'warning' ? 'error warning' : 'error';
                
                setTimeout(() => {
                    errorDiv.style.display = 'none';
                }, 5000);
            }
        }

        const weatherApp = new WeatherApp();

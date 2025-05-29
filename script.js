  // Estado da aplicação
let currentTab = 'hoje';
let searchVisible = false;
let currentLocation = {
    city: 'Local atual',
    state: '',
    latitude: null,
    longitude: null
};

// Tenta obter geolocalização do navegador
navigator.geolocation.getCurrentPosition(async (position) => {
    currentLocation.latitude = position.coords.latitude;
    currentLocation.longitude = position.coords.longitude;

    // Tenta buscar o nome da cidade via Open-Meteo reverse geocoding
    try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${currentLocation.latitude}&longitude=${currentLocation.longitude}&language=pt&format=json`);
        const data = await response.json();

        if (data && data.name) {
            currentLocation.city = data.name;
            currentLocation.state = data.admin1 || '';
        }
    } catch (error) {
        console.warn('Não foi possível identificar a cidade automaticamente.');
    }

    // Atualiza UI e carrega dados do clima
    document.getElementById('location-text').textContent = `${currentLocation.city}${currentLocation.state ? ', ' + currentLocation.state : ''}`;
    fetchWeatherData();
}, (error) => {
    console.warn('Usuário negou acesso à localização ou ocorreu um erro.', error);
    // Se a localização for negada, continua com padrão
    currentLocation = {
        city: 'Goiânia',
        state: 'GO',
        latitude: -16.6799,
        longitude: -49.255
    };
    document.getElementById('location-text').textContent = `${currentLocation.city}, ${currentLocation.state}`;
    fetchWeatherData();
});


// Variável para armazenar os dados meteorológicos
        let weatherData = null;
        
        // Funções utilitárias
        function getWeatherIcon(conditionCode) {
            const icons = {
                '0': 'sun',            // Clear sky
                '1': 'sun',             // Mainly clear
                '2': 'cloud',          // Partly cloudy
                '3': 'cloud',          // Overcast
                '45': 'cloud-fog',     // Fog
                '48': 'cloud-fog',      // Depositing rime fog
                '51': 'cloud-drizzle',  // Drizzle: Light
                '53': 'cloud-drizzle',  // Drizzle: Moderate
                '55': 'cloud-drizzle',  // Drizzle: Dense
                '56': 'cloud-drizzle',  // Freezing Drizzle: Light
                '57': 'cloud-drizzle',  // Freezing Drizzle: Dense
                '61': 'cloud-rain',     // Rain: Slight
                '63': 'cloud-rain',     // Rain: Moderate
                '65': 'cloud-rain',    // Rain: Heavy
                '66': 'cloud-rain',     // Freezing Rain: Light
                '67': 'cloud-rain',    // Freezing Rain: Heavy
                '71': 'cloud-snow',     // Snow fall: Slight
                '73': 'cloud-snow',    // Snow fall: Moderate
                '75': 'cloud-snow',    // Snow fall: Heavy
                '77': 'cloud-snow',    // Snow grains
                '80': 'cloud-rain',    // Rain showers: Slight
                '81': 'cloud-rain',     // Rain showers: Moderate
                '82': 'cloud-rain',     // Rain showers: Violent
                '85': 'cloud-snow',     // Snow showers: Slight
                '86': 'cloud-snow',     // Snow showers: Heavy
                '95': 'cloud-lightning',// Thunderstorm: Slight or moderate
                '96': 'cloud-lightning',// Thunderstorm with slight hail
                '99': 'cloud-lightning' // Thunderstorm with heavy hail
            };
            return icons[conditionCode.toString()] || 'sun';
        }

        function getIconColor(condition) {
            const colors = {
                'sun': 'icon-yellow',
                'cloud': 'icon-gray',
                'cloud-rain': 'icon-blue',
                'cloud-snow': 'icon-blue',
                'cloud-fog': 'icon-gray',
                'cloud-drizzle': 'icon-blue',
                'cloud-lightning': 'icon-purple'
            };
            return colors[condition] || 'icon-yellow';
        }

        function getConditionText(conditionCode) {
            const conditions = {
                '0': 'Céu limpo',
                '1': 'Poucas nuvens',
                '2': 'Parcialmente nublado',
                '3': 'Nublado',
                '45': 'Neblina',
                '48': 'Neblina com geada',
                '51': 'Chuvisco leve',
                '53': 'Chuvisco moderado',
                '55': 'Chuvisco intenso',
                '56': 'Chuvisco congelante leve',
                '57': 'Chuvisco congelante intenso',
                '61': 'Chuva leve',
                '63': 'Chuva moderada',
                '65': 'Chuva forte',
                '66': 'Chuva congelante leve',
                '67': 'Chuva congelante forte',
                '71': 'Queda de neve leve',
                '73': 'Queda de neve moderada',
                '75': 'Queda de neve forte',
                '77': 'Grãos de neve',
                '80': 'Pancadas de chuva leves',
                '81': 'Pancadas de chuva moderadas',
                '82': 'Pancadas de chuva violentas',
                '85': 'Pancadas de neve leves',
                '86': 'Pancadas de neve fortes',
                '95': 'Tempestade',
                '96': 'Tempestade com granizo leve',
                '99': 'Tempestade com granizo forte'
            };
            return conditions[conditionCode.toString()] || 'Condição desconhecida';
        }

        function getAlertSeverity(alert) {
            if (alert.includes('tempestade') || alert.includes('forte') || alert.includes('violenta')) {
                return 'high';
            } else if (alert.includes('moderada') || alert.includes('alerta')) {
                return 'medium';
            } else {
                return 'low';
            }
        }

        // Funções de interface
        function toggleSearch() {
            const searchInput = document.getElementById('search-input');
            searchVisible = !searchVisible;
            
            if (searchVisible) {
                searchInput.classList.remove('hidden');
                searchInput.focus();
            } else {
                searchInput.classList.add('hidden');
            }
        }

        async function handleSearch(event) {
            if (event.key === 'Enter') {
                const searchInput = document.getElementById('search-input');
                const cityName = searchInput.value.trim();
                
                if (cityName) {
                    try {
                        // Mostrar estado de carregamento
                        document.getElementById('location-text').textContent = 'Buscando...';
                        
                        // Primeiro, geocodificar o nome da cidade para obter coordenadas
                        const geocodeResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=pt&format=json`);
                        const geocodeData = await geocodeResponse.json();
                        
                        if (geocodeData.results && geocodeData.results.length > 0) {
                            const location = geocodeData.results[0];
                            currentLocation = {
                                city: location.name,
                                state: location.admin1 || '',
                                latitude: location.latitude,
                                longitude: location.longitude
                            };
                            
                            document.getElementById('location-text').textContent = `${currentLocation.city}${currentLocation.state ? ', ' + currentLocation.state : ''}`;
                            searchInput.value = '';
                            toggleSearch();
                            
                            // Atualizar dados meteorológicos
                            await fetchWeatherData();
                        } else {
                            alert('Cidade não encontrada. Tente novamente.');
                            document.getElementById('location-text').textContent = `${currentLocation.city}${currentLocation.state ? ', ' + currentLocation.state : ''}`;
                        }
                    } catch (error) {
                        console.error('Erro ao buscar cidade:', error);
                        alert('Erro ao buscar cidade. Tente novamente.');
                        document.getElementById('location-text').textContent = `${currentLocation.city}${currentLocation.state ? ', ' + currentLocation.state : ''}`;
                    }
                }
            }
        }

        function switchTab(tab) {
            if (!weatherData) return;
            
            currentTab = tab;
            
            // Atualizar visual das abas
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            
            // Atualizar conteúdo
            renderForecast();
        }

        function renderForecast() {
            if (!weatherData) return;
            
            const container = document.getElementById('forecast-container');
            let html = '';
            
            try {
                if (currentTab === 'hoje') {
                    // Previsão horária para as próximas 24 horas
                    const now = new Date();
                    const currentHour = now.getHours();
                    const hourly = weatherData.hourly || {};
                    
                    for (let i = 0; i < 24; i++) {
                        const hourIndex = (currentHour + i) % 24;
                        const timeText = i === 0 ? 'Agora' : `${hourIndex}h`;
                        const temp = hourly.temperature_2m?.[hourIndex] || '--';
                        const rain = hourly.precipitation_probability?.[hourIndex] || '--';
                        const conditionCode = hourly.weather_code?.[hourIndex] || 0;
                        const conditionIcon = getWeatherIcon(conditionCode);
                        const iconColor = getIconColor(conditionIcon);
                        
                        html += `
                            <div class="forecast-item">
                                <span class="forecast-time">${timeText}</span>
                                <div>
                                    <i data-lucide="${conditionIcon}" class="icon-medium ${iconColor}"></i>
                                </div>
                                <span class="forecast-temp">${Math.round(temp)}°</span>
                                <span class="forecast-rain">${rain}%</span>
                            </div>
                        `;
                    }
                } else {
                    // Previsão semanal
                    const daily = weatherData.daily || {};
                    const days = daily.time?.length || 0;
                    
                    for (let index = 0; index < Math.min(days, 7); index++) {
                        const day = daily.time?.[index] || new Date();
                        const date = new Date(day);
                        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                        const dayName = index === 0 ? 'Hoje' : index === 1 ? 'Amanhã' : dayNames[date.getDay()];
                        
                        const high = daily.temperature_2m_max?.[index] || '--';
                        const low = daily.temperature_2m_min?.[index] || '--';
                        const rain = daily.precipitation_probability_max?.[index] || '--';
                        const conditionCode = daily.weather_code?.[index] || 0;
                        const conditionIcon = getWeatherIcon(conditionCode);
                        const iconColor = getIconColor(conditionIcon);
                        
                        html += `
                            <div class="forecast-item">
                                <span class="forecast-time">${dayName}</span>
                                <div>
                                    <i data-lucide="${conditionIcon}" class="icon-medium ${iconColor}"></i>
                                </div>
                                <div class="forecast-temp-range">
                                    <span class="forecast-temp">${Math.round(high)}°</span>
                                    <span class="forecast-temp-low">${Math.round(low)}°</span>
                                </div>
                                <span class="forecast-rain">${rain}%</span>
                            </div>
                        `;
                    }
                }
                
                container.innerHTML = html;
                lucide.createIcons();
            } catch (error) {
                console.error('Erro ao renderizar previsão:', error);
                container.innerHTML = '<div class="text-center text-white/70 py-4">Erro ao carregar previsão</div>';
            }
        }

        function updateTime() {
            const now = new Date();
            const timeString = now.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            document.getElementById('last-update').textContent = `Atualizado às ${timeString}`;
        }

        async function fetchWeatherData() {
            try {
                // Mostrar estado de carregamento
                document.getElementById('current-temp').textContent = '--°';
                document.getElementById('current-condition').textContent = 'Carregando...';
                document.getElementById('feels-like').textContent = 'Sensação térmica --°';
                document.getElementById('forecast-container').innerHTML = '<div class="text-center text-white/70 py-4">Carregando...</div>';
                
                // Construir URL da API
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLocation.latitude}&longitude=${currentLocation.longitude}&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current_weather=true&timezone=auto&forecast_days=7`;
                
                const response = await fetch(url);
                weatherData = await response.json();
                
                // Processar dados recebidos
                processWeatherData();
            } catch (error) {
                console.error('Erro ao buscar dados meteorológicos:', error);
                document.getElementById('current-condition').textContent = 'Erro ao carregar dados';
                document.getElementById('forecast-container').innerHTML = '<div class="text-center text-white/70 py-4">Erro ao carregar previsão</div>';
            }
        }

        function processWeatherData() {
            if (!weatherData) return;
            
            try {
                // Atualizar clima atual
                const currentWeather = weatherData.current_weather || {};
                const currentTemp = currentWeather.temperature || '--';
                const conditionCode = currentWeather.weathercode || 0;
                const conditionText = getConditionText(conditionCode);
                const conditionIcon = getWeatherIcon(conditionCode);
                const iconColor = getIconColor(conditionIcon);
                
                document.getElementById('current-temp').textContent = `${Math.round(currentTemp)}°`;
                document.getElementById('current-condition').textContent = conditionText;
                
                const iconElement = document.getElementById('current-weather-icon');
                if (iconElement) {
                    iconElement.setAttribute('data-lucide', conditionIcon);
                    iconElement.className = `icon-large ${iconColor}`;
                }
                
                // Sensação térmica (simplificado)
                const feelsLike = Math.round(currentTemp + (Math.random() * 2 - 1));
                document.getElementById('feels-like').textContent = `Sensação térmica ${feelsLike}°`;
                
                // Dados simulados (a API gratuita não fornece todos esses dados)
                document.getElementById('humidity').textContent = `${Math.round(50 + Math.random() * 30)}%`;
                document.getElementById('wind').textContent = `${Math.round((currentWeather.windspeed || 0) * 3.6)} km/h`;
                document.getElementById('visibility').textContent = `${Math.round(5 + Math.random() * 10)} km`;
                document.getElementById('uv-index').textContent = Math.round(1 + Math.random() * 10);
                
                // Gerar alertas
                generateAlerts();
                
                // Renderizar previsão
                renderForecast();
                
                // Atualizar horário
                updateTime();
                
                // Atualizar ícones
                if (window.lucide) {
                    lucide.createIcons();
                }
            } catch (error) {
                console.error('Erro ao processar dados:', error);
            }
        }

        function generateAlerts() {
            if (!weatherData) return;
            
            const alertsContainer = document.getElementById('alerts-container');
            alertsContainer.innerHTML = '';
            
            const alerts = [];
            const daily = weatherData.daily || {};
            
            try {
                // Verificar condições para alertas
                const precipitation = daily.precipitation_probability_max || [];
                const maxPrecipitation = Math.max(...precipitation);
                
                if (maxPrecipitation > 70) {
                    alerts.push({
                        severity: 'high',
                        title: 'Alerta de Chuva Forte',
                        message: 'Probabilidade de chuva intensa nos próximos dias. Prepare-se para possíveis alagamentos.',
                        time: 'Próximos dias'
                    });
                } else if (maxPrecipitation > 40) {
                    alerts.push({
                        severity: 'medium',
                        title: 'Possibilidade de Chuva',
                        message: 'Chuva moderada esperada. Leve um guarda-chuva ao sair.',
                        time: 'Próximos dias'
                    });
                }
                
                const tempsMax = daily.temperature_2m_max || [];
                const maxTemp = Math.max(...tempsMax);
                if (maxTemp > 35) {
                    alerts.push({
                        severity: 'medium',
                        title: 'Alerta de Calor',
                        message: 'Temperaturas altas esperadas. Mantenha-se hidratado e evite exposição prolongada ao sol.',
                        time: 'Próximos dias'
                    });
                }
                
                const tempsMin = daily.temperature_2m_min || [];
                const minTemp = Math.min(...tempsMin);
                if (minTemp < 10) {
                    alerts.push({
                        severity: 'medium',
                        title: 'Alerta de Frio',
                        message: 'Temperaturas baixas esperadas. Vista-se adequadamente para o frio.',
                        time: 'Próximos dias'
                    });
                }
                
                // Adicionar alertas à interface
                alerts.forEach(alert => {
                    const alertDiv = document.createElement('div');
                    alertDiv.className = `alert alert-${alert.severity}`;
                    
                    alertDiv.innerHTML = `
                        <div class="alert-content">
                            <i data-lucide="alert-triangle" class="icon"></i>
                            <div>
                                <div class="alert-title">${alert.title}</div>
                                <div class="alert-message">${alert.message}</div>
                                <div class="alert-time">Válido: ${alert.time}</div>
                            </div>
                        </div>
                    `;
                    
                    alertsContainer.appendChild(alertDiv);
                });
                
                // Se não houver alertas
                if (alerts.length === 0) {
                    alertsContainer.innerHTML = '<div class="text-center text-white/70 py-4">Nenhum alerta no momento</div>';
                }
                
                // Atualizar ícones
                if (window.lucide) {
                    lucide.createIcons();
                }
            } catch (error) {
                console.error('Erro ao gerar alertas:', error);
                alertsContainer.innerHTML = '<div class="text-center text-white/70 py-4">Erro ao carregar alertas</div>';
            }
        }

        // Inicialização
        document.addEventListener('DOMContentLoaded', function() {
            // Inicializar ícones do Lucide
            if (window.lucide) {
                lucide.createIcons();
            } else {
                console.warn('Lucide não está disponível');
            }
            
            // Atualizar localização inicial
            document.getElementById('location-text').textContent = `${currentLocation.city}${currentLocation.state ? ', ' + currentLocation.state : ''}`;
            
            // Buscar dados meteorológicos iniciais
            fetchWeatherData();
            
            // Atualizar periodicamente (a cada 30 minutos)
            setInterval(fetchWeatherData, 30 * 60 * 1000);
            setInterval(updateTime, 60000); // Atualizar horário a cada minuto
        });

        // Eventos de interface
        document.getElementById('search-button').addEventListener('click', toggleSearch);
        document.getElementById('search-input').addEventListener('keydown', handleSearch);
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function(event) {
                switchTab(event.target.dataset.tab);
            });
        });
        document.getElementById('location-text').addEventListener('click', toggleSearch);
        document.getElementById('current-weather-icon').addEventListener('click', toggleSearch);
        document.getElementById('current-condition').addEventListener('click', toggleSearch);
        document.getElementById('feels-like').addEventListener('click', toggleSearch);
        document.getElementById('humidity').addEventListener('click', toggleSearch);
        document.getElementById('wind').addEventListener('click', toggleSearch);
        document.getElementById('visibility').addEventListener('click', toggleSearch);
        document.getElementById('uv-index').addEventListener('click', toggleSearch);
        document.getElementById('last-update').addEventListener('click', toggleSearch);
        document.getElementById('alerts-container').addEventListener('click', toggleSearch);
        document.getElementById('forecast-container').addEventListener('click', toggleSearch);
        document.getElementById('search-input').addEventListener('focus', function() {
            this.classList.remove('hidden');
        });
        document.getElementById('search-input').addEventListener('blur', function() {
            if (!this.value) {
                this.classList.add('hidden');
            }
        });
        document.getElementById('search-input').addEventListener('keyup', function(event) {
            if (event.key === 'Escape') {
                this.classList.add('hidden');
                this.value = '';
                searchVisible = false;
            }
        });
        document.getElementById('search-input').addEventListener('click', function(event) {
            event.stopPropagation(); // Impede o fechamento ao clicar no campo de busca
        });
        document.addEventListener('click', function(event) {
            if (!event.target.closest('#search-input') && searchVisible) {
                document.getElementById('search-input').classList.add('hidden');
                searchVisible = false;
            }
        });
        // Função para atualizar a localização inicial
        function updateInitialLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(position => {
                    currentLocation.latitude = position.coords.latitude;
                    currentLocation.longitude = position.coords.longitude;
                    
                    // Geocodificar a localização para obter cidade e estado
                    fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${currentLocation.latitude}&longitude=${currentLocation.longitude}&language=pt&format=json`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.results && data.results.length > 0) {
                                const location = data.results[0];
                                currentLocation.city = location.name || '';
                                currentLocation.state = location.admin1 || '';
                                
                                document.getElementById('location-text').textContent = `${currentLocation.city}${currentLocation.state ? ', ' + currentLocation.state : ''}`;
                                
                                // Buscar dados meteorológicos iniciais
                                fetchWeatherData();
                            }
                        })
                        .catch(error => console.error('Erro ao geocodificar localização:', error));
                }, error => {
                    console.error('Erro ao obter localização:', error);
                });
            } else {
                console.warn('Geolocalização não suportada pelo navegador');
            }
        }
        // Atualizar localização inicial ao carregar a página
        updateInitialLocation();
        // Atualizar localização inicial ao clicar no texto de localização
        document.getElementById('location-text').addEventListener('click', updateInitialLocation);
        // Atualizar localização inicial ao clicar no ícone do tempo atual
        document.getElementById('current-weather-icon').addEventListener('click', updateInitialLocation);
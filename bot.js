const mineflayer = require('mineflayer');
const config = require('./config.json');

class MinecraftAFKBot {
    constructor() {
        this.bot = null;
        this.reconnectAttempts = 0;
        this.keepAliveInterval = null;
        this.isConnected = false;
    }

    // Simular presencia de mods para servidor Forge
    setupForgeCompatibility() {
        const modList = config.mods.map((mod, index) => ({
            modid: mod,
            version: '1.0.0' // Versión genérica para todos los mods
        }));

        return {
            fmlNetworkVersion: 2,
            channels: [
                'minecraft:unregister',
                'minecraft:register',
                'fml:handshake'
            ],
            mods: modList,
            registries: {}
        };
    }

    createBot() {
        console.log('🤖 Iniciando bot AFK para Minecraft...');
        
        const botOptions = {
            host: config.server.host,
            port: config.server.port,
            username: config.bot.username,
            auth: config.bot.auth,
            version: config.server.version,
            hideErrors: false
        };

        // Configurar soporte para Forge si está habilitado
        if (config.forge.enabled) {
            botOptions.forge = this.setupForgeCompatibility();
            console.log('⚙️ Forge habilitado - Versión:', config.forge.version);
        }

        this.bot = mineflayer.createBot(botOptions);
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Evento: Bot conectado exitosamente
        this.bot.on('login', () => {
            console.log('✅ Bot conectado exitosamente al servidor');
            console.log(`📍 Jugador: ${this.bot.username}`);
            console.log(`🌐 Servidor: ${config.server.host}:${config.server.port}`);
            
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            if (config.keepAlive.enabled) {
                this.startKeepAlive();
            }
        });

        // Evento: Bot spawneado en el mundo
        this.bot.on('spawn', () => {
            console.log('🌍 Bot spawneado en el mundo');
            console.log('😴 Modo AFK activado - El bot permanecerá inmóvil');
        });

        // Evento: Mensaje del chat
        this.bot.on('chat', (username, message) => {
            if (username === this.bot.username) return;
            console.log(`💬 [${username}]: ${message}`);
        });

        // Evento: Desconexión
        this.bot.on('end', (reason) => {
            console.log('❌ Bot desconectado:', reason || 'Razón desconocida');
            this.isConnected = false;
            this.stopKeepAlive();
            
            if (config.reconnect.enabled) {
                this.handleReconnect();
            }
        });

        // Evento: Error
        this.bot.on('error', (err) => {
            console.error('🚨 Error del bot:', err.message);
            
            if (err.message.includes('Invalid session')) {
                console.log('⚠️ Sesión inválida - Reintentando conexión...');
            } else if (err.message.includes('ECONNREFUSED')) {
                console.log('⚠️ Servidor no disponible - Reintentando en unos momentos...');
            }
        });

        // Evento: Muerte del bot
        this.bot.on('death', () => {
            console.log('💀 El bot ha muerto - Respawneando...');
            setTimeout(() => {
                this.bot.respawn();
            }, 2000);
        });

        // Evento: Kicked del servidor
        this.bot.on('kicked', (reason) => {
            console.log('👢 Bot expulsado del servidor:', reason);
        });
    }

    startKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
        }

        this.keepAliveInterval = setInterval(() => {
            if (this.isConnected && this.bot) {
                // Enviar un paquete keep-alive muy sutil
                try {
                    // Rotar ligeramente la cabeza para mantenerse "activo"
                    if (this.bot.entity) {
                        this.bot.look(this.bot.entity.yaw + 0.01, this.bot.entity.pitch);
                    }
                } catch (error) {
                    console.log('⚠️ Error en keep-alive:', error.message);
                }
            }
        }, config.keepAlive.interval);

        console.log('💓 Keep-alive activado cada', config.keepAlive.interval / 1000, 'segundos');
    }

    stopKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }

    handleReconnect() {
        if (config.reconnect.maxRetries !== -1 && this.reconnectAttempts >= config.reconnect.maxRetries) {
            console.log('❌ Máximo número de reintentos alcanzado');
            return;
        }

        this.reconnectAttempts++;
        console.log(`🔄 Reintentando conexión (${this.reconnectAttempts})...`);
        
        setTimeout(() => {
            this.createBot();
        }, config.reconnect.delay);
    }

    start() {
        console.log('🚀 Iniciando Minecraft AFK Bot');
        console.log('⚙️ Configuración cargada:');
        console.log(`   - Servidor: ${config.server.host}:${config.server.port}`);
        console.log(`   - Versión: ${config.server.version}`);
        console.log(`   - Usuario: ${config.bot.username}`);
        console.log(`   - Forge: ${config.forge.enabled ? 'Sí' : 'No'}`);
        console.log('');

        this.createBot();
    }

    stop() {
        console.log('🛑 Deteniendo bot...');
        this.stopKeepAlive();
        
        if (this.bot) {
            this.bot.quit();
        }
    }
}

// Manejo de señales del sistema
process.on('SIGINT', () => {
    console.log('\n🛑 Señal de interrupción recibida');
    if (global.afkBot) {
        global.afkBot.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Señal de terminación recibida');
    if (global.afkBot) {
        global.afkBot.stop();
    }
    process.exit(0);
});

// Iniciar el bot
const afkBot = new MinecraftAFKBot();
global.afkBot = afkBot;
afkBot.start();

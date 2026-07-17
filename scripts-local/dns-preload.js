/**
 * Preload para corrigir falhas de resolucao DNS SRV (mongodb+srv://) neste
 * ambiente Windows (provavel interferencia do Cloudflare WARP). Usar via
 * NODE_OPTIONS="--require ./scripts-local/dns-preload.js" em invocacoes de
 * script npm que nao permitem injecao de codigo inline.
 */
require('dns').setServers(['8.8.8.8']);

// Helper function to get client IP address
const getClientIp = (req) => {
    // List of headers in order of reliability
    const ipHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'cf-connecting-ip',  // Cloudflare
        'true-client-ip',    // Akamai and Cloudflare
        'x-cluster-client-ip',
        'x-forwarded',
        'forwarded-for',
        'forwarded',
        'http_client_ip',
        'x-remote-ip',
        'x-remote-addr'
    ];
    
    // Check each header
    for (const header of ipHeaders) {
        const ip = req.headers[header];
        if (ip) {
            // For x-forwarded-for, take the first IP (client's real IP)
            if (header === 'x-forwarded-for') {
                const ips = ip.split(',');
                return ips[0].trim();
            }
            return ip.trim();
        }
    }
    
    // Fallback to socket remote address
    return req.socket?.remoteAddress || 
           req.connection?.remoteAddress || 
           req.ip || 
           null;
};


module.exports  = {
    getClientIp
}
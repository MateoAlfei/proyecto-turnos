const jwt = require('jsonwebtoken');

// ¡OJO! Esta clave secreta tiene que ser EXACTAMENTE la misma que pusiste en index.js para el login
const JWT_SECRET = 'Turnero2026*'; 

const verificarToken = (req, res, next) => {
  // 1. Buscamos el token en la cabecera (Header) de la petición
  const authHeader = req.headers['authorization'];
  
  // El formato estándar que manda el Frontend es "Bearer eyJhbGciOiJIUz..."
  // Así que lo partimos por el espacio y nos quedamos con la segunda parte (el token limpio)
  const token = authHeader && authHeader.split(' ')[1];

  // 2. Si no mandó token, lo rebotamos en la puerta
  if (!token) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere un Token.' });
  }

  // 3. Si hay token, verificamos que sea real y no esté vencido
  jwt.verify(token, JWT_SECRET, (err, negocio) => {
    if (err) {
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
    
    // Si todo está bien, guardamos los datos del negocio en la "req" y lo dejamos pasar
    req.negocioLogueado = negocio;
    next(); // "Podés pasar al Dashboard"
  });
};

module.exports = { verificarToken };
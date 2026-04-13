require('dotenv').config();

async function escanearModelos() {
  console.log("📡 Conectando con la central de Google...");
  
  // Le pegamos directo a la API de ellos con tu llave
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
  
  try {
    const respuesta = await fetch(url);
    const datos = await respuesta.json();
    
    if (datos.error) {
      console.log("❌ GOOGLE REBOTÓ LA LLAVE:");
      console.log(datos.error.message);
    } else {
      console.log("✅ ¡ÉXITO! GOOGLE TE DEJÓ ENTRAR.");
      console.log("Estos son los modelos exactos que tenés habilitados para usar:");
      
      // Filtramos solo los nombres para que sea fácil de leer
      const nombres = datos.models.map(m => m.name.replace('models/', ''));
      console.log(nombres);
    }
  } catch (error) {
    console.error("Error de conexión a internet:", error);
  }
}

escanearModelos();
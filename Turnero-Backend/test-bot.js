require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function probarBot() {
  try {
    // Usamos el modelo gratis y rapidísimo
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 1. SIMULAMOS TU BASE DE DATOS (Lo que después tu código traerá con SQL)
    const infoNegocio = "Barbería Los Hermanos";
    const servicios = [
      { id: 1, nombre: "Corte Clásico", precio: 8000 },
      { id: 2, nombre: "Corte + Barba", precio: 12000 }
    ];
    const horariosLibresHoy = ["16:00", "16:30", "18:00"];

    // 2. EL MENSAJE DEL CLIENTE
    const mensajeCliente = "Hola jefe, qué precio tiene el corte y barba? tenés lugar mañana a la mañana?";

    // 3. EL PROMPT MAESTRO (Acá le programamos la cabeza al bot)
    const promptMaestro = `
      Sos el recepcionista virtual por WhatsApp de "${infoNegocio}".
      Sos amable, usás un tono argentino informal (usá "vos", "che", "hola", etc.), y usás emojis.
      Tu objetivo es responder la duda del cliente y guiarlo para que elija un horario de los disponibles.
      
      INFORMACIÓN DEL SISTEMA PARA QUE USES (No la inventes):
      - Servicios que ofrecemos hoy: ${JSON.stringify(servicios)}
      - Horarios libres para hoy: ${JSON.stringify(horariosLibresHoy)}
      
      Regla vital: Si te pide un horario que NO está en la lista de libres, decile amablemente que no se puede y ofrécele los que sí están.
      
      Mensaje del cliente: "${mensajeCliente}"
      
      Tu respuesta directa para enviarle por WhatsApp:
    `;

    console.log("🧠 Pensando la respuesta...");
    
    // 4. Disparamos la consulta a Google
    const resultado = await model.generateContent(promptMaestro);
    
    console.log("\n🤖 RESPUESTA DEL BOT:");
    console.log(resultado.response.text());

  } catch (error) {
    console.error("Error conectando con Gemini:", error);
  }
}

probarBot();
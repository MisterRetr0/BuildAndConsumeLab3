const express = require('express');
const app = express();
const PORT = 5000;
cors = require('cors');
app.use(cors());
app.use(express.json()); // Habilita la lectura de JSON en el cuerpo (body) de las peticiones
app.use((req, res, next) => { // Configuración de CORS para permitir solicitudes desde cualquier origen
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
// Simulación de Base de Datos en memoria
let tareas = [
  { id: 1, texto: "Aprender conceptos básicos de Docker", estado: "pendiente" }, //anexo de estado de la tarea
  { id: 2, texto: "Desplegar mi primer arquitectura de Microservicios", estado: "pendiente" } //anexo de estado de la tarea
];
// [GET] Obtener la lista completa de tareas
app.get('/api/tareas', (req, res) => {
  res.json(tareas);
});
// [POST] Crear una nueva tarea
app.post('/api/tareas', (req, res) => {
  const nuevaTarea = { id: Date.now(), texto: req.body.texto, estado: "pendiente" }; //anexo de estado de la tarea
  tareas.push(nuevaTarea);
  res.status(201).json(nuevaTarea);
});
// [DELETE] Eliminar una tarea específica mediante su ID en la URL
app.delete('/api/tareas/:id', (req, res) => {
  const idEliminar = parseInt(req.params.id);
  tareas = tareas.filter(t => t.id !== idEliminar);
  res.json({ mensaje: "Tarea eliminada correctamente" });
});
// [PATCH] Actualizar el estado de una tarea específica mediante su ID en la URL
app.patch('/api/tareas/:id', (req, res) => {
  const tarea = tareas.find(t => t.id === parseInt(req.params.id));
  if (!tarea) return res.status(404).json({ mensaje: "No existe" });
  tarea.estado = req.body.estado;   // "pendiente" | "progreso" | "hecho"
  res.json(tarea);
});
app.listen(PORT, () => console.log(`API REST corriendo en el puerto ${PORT}`));
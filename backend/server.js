const express = require('express');
const app = express();
const PORT = 5000;
cors = require('cors');
app.use(cors());
app.use(express.json()); // Habilita la lectura de JSON en el cuerpo (body) de las peticiones
// Simulación de Base de Datos en memoria
let tareas = [
  { id: 1, texto: "Aprender conceptos básicos de Docker" },
  { id: 2, texto: "Desplegar mi primer arquitectura de Microservicios" }
];
// [GET] Obtener la lista completa de tareas
app.get('/api/tareas', (req, res) => {
  res.json(tareas);
});
// [POST] Crear una nueva tarea
app.post('/api/tareas', (req, res) => {
  const nuevaTarea = { id: Date.now(), texto: req.body.texto };
  tareas.push(nuevaTarea);
  res.status(201).json(nuevaTarea);
});
// [DELETE] Eliminar una tarea específica mediante su ID en la URL
app.delete('/api/tareas/:id', (req, res) => {
  const idEliminar = parseInt(req.params.id);
  tareas = tareas.filter(t => t.id !== idEliminar);
  res.json({ mensaje: "Tarea eliminada correctamente" });
});
app.listen(PORT, () => console.log(`API REST corriendo en el puerto ${PORT}`));
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(express.json());
// Habilitar CORS para todas las rutas
app.use(cors());


// ---- Conexión a Mongo (una sola vez) ----
const uri = 'mongodb+srv://glu_db_user:8aa8ii1oo1@cluster0.te6deme.mongodb.net/';
const dbName = 'ProviSys';


// USUARIOS---> APARTADO DE LA API PARA CARGAR DATOS DE USUARIOS
let usuarios; // colección compartida por las rutas
let productos; // colección compartida por las rutas
let posts;
let proveedores;
let relaciones;

async function init() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('✅ Conectado a MongoDB');

  const db = client.db(dbName);
  usuarios = db.collection('usuarios');
  productos = db.collection('productos');
  posts = db.collection('posts');
  proveedores = db.collection('proveedores');
  relaciones = db.collection('relaciones');

  // 👉 Ruta raíz de cortesía
  app.get('/', (req, res) => res.send('API Usuarios activa. Prueba GET /usuarios'));

  // 📄 GET /usuarios → listar todos
  app.get('/usuarios', async (req, res) => {
    const docs = await usuarios.find().toArray();
    console.log(docs);
    res.json(docs);
  });

  app.get('relaciones', async (req, res) => {
    const docs = await relaciones.find().toArray();
    console.log(docs);
    res.json(docs);
  });

  // GET /productos -> obtener uno por id_product
  app.get('/productos', async (req, res) => {
    const docs = await productos.find().toArray();
    console.log(docs);
    res.json(docs);
  });

  app.get('/posts',async (req,res)=>{
    const docs=await posts.find().toArray();
    console.log(docs);
    res.json(docs);
  });

  // 🔎 GET /usuarios/:id_user → obtener uno por id_user
  app.get('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    const id = parseInt(id_user);
    const doc = await usuarios.findOne({ id_user: id });

    console.log(doc);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });
    // 🔎 GET /posts/:id_product → obtener uno por id_user
  app.get('/posts/:id_product', async (req, res) => {
    const { id_product } = req.params;
    const id = parseInt(id_product);
    const doc = await posts.findOne({ id_product: id });

    console.log(doc);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

//PROVEEDORES--> APARTADO DE LA API PARA CARGAR DATOS DE PROVEEDORES

  app.get('/proveedores', async (req, res) => {
    try {
      const docs = await proveedores.find().toArray();
      res.json(docs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener proveedores' });
    }
  });

  app.get('/proveedores/:id_provider', async (req, res) => {
    const { id_provider } = req.params;
    const id = parseInt(id_provider);
    const doc = await proveedores.findOne({ id_provider: id });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

  // GET /productos/:id_product -> obtener uno por id_product
  app.get('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    const id = parseInt(id_product);
    const doc = await productos.findOne({ id_product: id });
    console.log(doc);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

  // ➕ POST /usuarios → crear
  app.post('/usuarios', async (req, res) => {
    const { name, email, profile_picture } = req.body;
    if (!name || !email || !profile_picture) return res.status(400).json({ error: 'nombre, email y foto de perfil son obligatorios' });

    const nuevo = { name, email, profile_picture };
    const r = await usuarios.insertOne(nuevo);
    res.status(201).json({ id_user: r.insertedId, ...nuevo });
  });

  // POST /Productos → crear
  app.post('/productos', async (req, res) => {
    const { name, description, price } = req.body;
    if (!name || !description || !price ) return res.status(400).json({ error: 'nombre, descripción y precio son obligatorios' });
    const nuevo = { name, description, category, price, quantity, images, status, createdAt, updatedAt };
    const r = await productos.insertOne(nuevo);
    res.status(201).json({ id_product: r.insertedId, ...nuevo });
  });

  // 🔁 PUT /usuarios/:id_user → actualizar (parcial: solo campos enviados)
  app.put('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    if (!ObjectId.isValid(id_user)) return res.status(400).json({ error: 'ID no válido' });

    const { name, email, profile_picture } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (email  !== undefined) set.email  = email;
    if (profile_picture !== undefined) set.profile_picture = profile_picture;

    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const r = await usuarios.updateOne({ _id: new ObjectId(id_user) }, { $set: set });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });

    const actualizado = await usuarios.findOne({ _id: new ObjectId(id_user) });
    res.json(actualizado);
  });

  // PUT /productos/:id_product → actualizar (parcial: solo campos enviados)
  app.put('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    if (!ObjectId.isValid(id_product)) return res.status(400).json({ error: 'ID no válido' });

    const { name, description, price } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (description  !== undefined) set.description  = description;
    if (price !== undefined) set.price = price;
    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const r = await productos.updateOne({ _id: new ObjectId(id_product) }, { $set: set });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    const actualizado = await productos.findOne({ _id: new ObjectId(id_product) });
    res.json(actualizado);
  });

  // ❌ DELETE /usuarios/:id_user → borrar
  app.delete('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    const id = parseInt(id_user);
    const r = await usuarios.deleteOne({ id_user: id });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    res.status(204).send();
  });

  // ❌ DELETE /productos/:id_product → borrar
  app.delete('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    if (!ObjectId.isValid(id_product)) return res.status(400).json({ error: 'ID no válido' });
    const r = await productos.deleteOne({ _id: new ObjectId(id_product) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    res.status(204).send();
  });

  // ▶️ Arrancar Express
  app.listen(port, () => {
    console.log(`🚀 API escuchando en http://localhost:${port}`);
  });
}

// Iniciar conexión + rutas
init().catch(err => {
  console.error('❌ Error iniciando:', err);
  process.exit(1);
});
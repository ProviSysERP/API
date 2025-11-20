import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
const port = 3000;

app.use(express.json());
// Habilitar CORS para todas las rutas
app.use(cors());


// ---- Conexión a Mongo (una sola vez) ----
const uri = 'mongodb+srv://glu_db_user:8aa8ii1oo1@cluster0.te6deme.mongodb.net/';
const dbName = 'ProviSys';

// Clave secreta para JWT
const SECRET_KEY = "MIDDLE-DEEP-HOME-TOOK-FLOOR";
const EXPIRES_IN = "24h";


let usuarios; 
let productos; 
let posts;
let proveedores;
let pedidos;
let mensajes;
let inventario;

async function init() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('✅ Conectado a MongoDB');

  const db = client.db(dbName);
  usuarios = db.collection('usuarios');
  productos = db.collection('productos');
  posts = db.collection('posts');
  proveedores = db.collection('proveedores');
  pedidos = db.collection('pedidos');
  mensajes = db.collection('mensajes');
  inventario = db.collection('inventario');

  // 👉 Ruta raíz de cortesía
  app.get('/', (req, res) => res.send('API Usuarios activa. Prueba GET /usuarios'));

  // 📄 GET /usuarios → listar todos
  app.get('/usuarios', async (req, res) => {
    const docs = await usuarios.find().toArray();
    //console.log(docs);
    res.json(docs);
  });
  // GET /inventario -> todos (ya tienes uno). Añadimos por proveedor:
  app.get('/inventario/porProveedor/:id_provider', async (req, res) => {
    try {
      const id_provider = parseInt(req.params.id_provider);
      if (isNaN(id_provider)) return res.status(400).json({ error: 'id_provider inválido' });
      const docs = await inventario.find({ id_provider }).toArray();
      res.json(docs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener inventario' });
    }
  });

  app.get('/pedidos', async (req, res) => {
    const docs = await pedidos.find().toArray();
    res.json(docs);
  });

  // GET /productos -> obtener uno por id_product
  app.get('/productos', async (req, res) => {
    const docs = await productos.find().toArray();
    //console.log(docs);
    res.json(docs);
  });

  app.get('/posts', async (req, res) => {
    const docs = await posts.find().toArray();
    //console.log(docs);
    res.json(docs);
  });

  app.post('/registrar', async (req, res) => {
    const { name, email, notifications, profile_picture, password, phone, address } = req.body;

    if (!name || !email || !profile_picture || !password || !phone)
      return res.status(400).json({ error: 'nombre, email, foto de perfil, contraseña y telefono son obligatorios' });


    if (!address || typeof address !== 'object') {
      return res.status(400).json({ error: 'El campo address es obligatorio y debe ser un objeto' });
    }

    const { street, city, state, postalcode, country } = address;

    if (!street || !city || !state || !postalcode || !country) {
      return res.status(400).json({ error: 'Todos los campos de dirección son obligatorios' });
    }

    const usuarioExistente = await usuarios.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'El email ya está en uso' });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();


    // Generar un id_user único
    const ultimoUsuario = await usuarios.find().sort({ id_user: -1 }).limit(1).toArray();
    const nuevoIdUser = ultimoUsuario.length > 0 ? ultimoUsuario[0].id_user + 1 : 1;

    const nuevo = {
      id_user: nuevoIdUser,
      name,
      email,
      notifications,
      profile_picture,
      passwordHash, phone,
      provider: false,
      admin: false,
      address:
      {
        street,
        city,
        state,
        postalcode: Number(postalcode),
        country
      },
      createdAt: now,
      updatedAt: now
    };

    await usuarios.insertOne(nuevo);
    res.status(201).json({
      message: "Usuario registrado correctamente",
      id_user: nuevoIdUser,
      ...nuevo
    });
  });

  app.post('/Login', async (req, res) => {
    const { email, password } = req.body;

    // Buscar usuario por name
    const db_user = await usuarios.findOne({ email });

    if (!db_user) {
      return res.status(400).json({ detail: "Correo incorrecto" });
    }

    // Comprobar contraseña
    const passwordMatch = await bcrypt.compare(password, db_user.passwordHash);


    if (!passwordMatch) {
      return res.status(400).json({ detail: "Contraseña incorrecta" });
    }

    // Crear token
    const token = jwt.sign(
      { sub: String(db_user.id_user) },
      SECRET_KEY,
      { expiresIn: EXPIRES_IN }
    );

    return res.json({
      message: "Login exitoso",
      usuario: db_user.nombre_usuario,
      access_token: token,
      token_type: "bearer",
    });
  });

  app.get('/usuarios/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No autorizado' });

    // Obtener el token del header "Bearer <token>"
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token inválido' });

    try {
      // Verificar token JWT
      const payload = jwt.verify(token, SECRET_KEY);

      // Buscar usuario por id_user almacenado en el token
      const usuario = await usuarios.findOne({ id_user: parseInt(payload.sub) });

      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

      // Devolver solo los campos que quieras exponer
      res.json({ id_user: usuario.id_user, });
      console.log(usuario.id_user);
    } catch (err) {
      console.warn("Token inválido o expirado");
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  });

    app.get('/inventario/:id_user', async (req, res) => {
      const { id_user } = req.params;
      const id = parseInt(id_user);
      const doc = await inventario.findOne({ id_user: id });
      if (!doc) return res.status(404).json({ error: 'No encontrado' });
      res.json(doc);
    });

  // 🔎 GET /usuarios/:id_user → obtener uno por id_user
  app.get('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    const id = parseInt(id_user);
    const doc = await usuarios.findOne({ id_user: id });

    //console.log(doc);
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

  app.get('/proveedores/porUser/:id_user', async (req, res) => {
    const { id_user } = req.params;
    const id = parseInt(id_user);
    const doc = await proveedores.findOne({ userId: { $in: [id] } });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

  app.get('/proveedores/porProducto/:id_provider', async (req, res) => {
    const { id_provider } = req.params;
    const id = parseInt(id_provider);
    const doc = await proveedores.findOne({ id_provider: id });
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

// POST /proveedores/:id_provider/rating -> agregar una reseña
  app.post('/proveedores/:id_provider/rating', async (req, res) => {
    try {
      const { id_provider } = req.params;
      const { userId, score, comment } = req.body;

      if (!userId || !score || !comment) {
        return res.status(400).json({ error: 'userId, score y comment son obligatorios' });
      }

      const proveedor = await proveedores.findOne({ id_provider: parseInt(id_provider) });
      if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });

      const usuario = await usuarios.findOne({ id_user: userId });
      const author = usuario ? usuario.name : "Anónimo";

      //Verificar si ya existe una reseña del usuario
      const existingIndex = (proveedor.rating || []).findIndex(r => r.userId === userId);
      const nuevaReseña = {
        userId,
        score,
        comment,
        author,
        createdAt: new Date()
      };

      if (existingIndex >= 0) {
        proveedor.rating[existingIndex] = nuevaReseña;
      } else {
        proveedor.rating = [...(proveedor.rating || []), nuevaReseña];
      }

      await proveedores.updateOne(
        { id_provider: parseInt(id_provider) },
        { $set: { rating: proveedor.rating, updatedAt: new Date() } }
      );

      res.status(201).json(nuevaReseña);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al agregar reseña' });
    }
  });


  // DELETE /proveedores/:id_provider/rating/:id_review -> eliminar una reseña
  app.delete('/proveedores/:id_provider/rating/:userId', async (req, res) => {
    try {
      const { id_provider, userId } = req.params;

      const proveedor = await proveedores.findOne({ id_provider: parseInt(id_provider) });
      if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });

      const newRating = (proveedor.rating || []).filter(r => r.userId !== parseInt(userId));

      if (newRating.length === (proveedor.rating || []).length) {
        return res.status(404).json({ error: 'Reseña no encontrada' });
      }

      await proveedores.updateOne(
        { id_provider: parseInt(id_provider) },
        { $set: { rating: newRating, updatedAt: new Date() } }
      );

      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al eliminar la reseña' });
    }
  });


  // GET /productos/:id_product -> obtener uno por id_product
  app.get('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    const id = parseInt(id_product);
    const doc = await productos.findOne({ id_product: id });
    //console.log(doc);
    if (!doc) return res.status(404).json({ error: 'No encontrado' });
    res.json(doc);
  });

  app.get('/mensajes/:id_user', async (req, res) => {

    const { id_user } = req.params;
    const id = parseInt(id_user);
    const doc = await mensajes.find({ $or: [{ user1: id }, { user2: id }] }).toArray();

    if (doc.length === 0) return res.status(404).json({ error: 'No encontrado' });

    res.json(doc);
  });

  // POST /Productos → crear
  app.post('/productos', async (req, res) => {
    const { name, description, price } = req.body;
    if (!name || !description || !price) return res.status(400).json({ error: 'nombre, descripción y precio son obligatorios' });
    const nuevo = { name, description, category, price, quantity, images, status, createdAt, updatedAt };
    const r = await productos.insertOne(nuevo);
    res.status(201).json({ id_product: r.insertedId, ...nuevo });
  });

  app.post('/pedidos', async (req, res) => {
    const { id_provider, id_user, products, total_price, address, status } = req.body;
    if (!id_user || !products || !total_price) { return res.status(400).json({ error: 'id_user, products y total_price son obligatorios' }); }
    const createdAt = new Date();
    const updatedAt = new Date();
    const nuevo = { id_provider, id_user, products, total_price, address: address || null, status: status || "Pendiente", sent_date: null, received_date: null, createdAt, updatedAt };
    const r = await pedidos.insertOne(nuevo);
    res.status(201).json({ id_delivery: r.insertedId, ...nuevo });
  });
  

  app.post('/mensajes', async (req, res) => {
    const { user1, user2 } = req.body;
    if (!user1 || !user2) return res.status(400).json({ error: 'user1 y user2 son obligatorios' });
    const newId = await mensajes.find().sort({ id_conversation: -1 }).limit(1).toArray();
    const newConversationId = newId.length > 0 ? newId[0].id_conversation + 1 : 1;
    const createdAt = new Date();
    const updatedAt = new Date();
    const nuevo = { id_conversation: newConversationId, user1, user2, messages: [], createdAt, updatedAt };

    const r = await mensajes.insertOne(nuevo);
    res.status(201).json({ id_conversation: r.insertedId, ...nuevo });
  });

 // POST /inventario -> añadir un producto al inventario (o incrementar si ya existe)
  app.post('/inventario', async (req, res) => {
    try {
      const { id_provider, id_product, quantity, unit_price } = req.body;
      if (id_provider === undefined || id_product === undefined || quantity === undefined) {
        return res.status(400).json({ error: 'id_provider, id_product y quantity son obligatorios' });
      }
      const now = new Date();
      const q = Number(quantity);
      if (isNaN(q) || q <= 0) return res.status(400).json({ error: 'quantity debe ser número positivo' });

      // si ya existe registro para ese proveedor+producto -> incrementa
      const existing = await inventario.findOne({ id_provider: Number(id_provider), id_product: Number(id_product) });
      if (existing) {
        const r = await inventario.updateOne(
          { _id: existing._id },
          { $inc: { quantity: q }, $set: { updatedAt: now, unit_price: unit_price ?? existing.unit_price } }
        );
        const updated = await inventario.findOne({ _id: existing._id });
        return res.status(200).json(updated);
      } else {
        const nuevo = {
          id_provider: Number(id_provider),
          id_product: Number(id_product),
          quantity: q,
          unit_price: unit_price ? Number(unit_price) : 0,
          createdAt: now,
          updatedAt: now
        };
        const r = await inventario.insertOne(nuevo);
        res.status(201).json({ _id: r.insertedId, ...nuevo });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al añadir inventario' });
    }
  });

  // 🔁 PUT /usuarios/:id_user → actualizar (parcial: solo campos enviados)
  app.put('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    if (!ObjectId.isValid(id_user)) return res.status(400).json({ error: 'ID no válido' });

    const { name, email, profile_picture, phone, street, city, state, postalcode, country} = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (email !== undefined) set.email = email;
    if (phone !== undefined) set.phone = phone;
    if (street !== undefined) set.street = street;
    if (city !== undefined) set.city = city;
    if (state !== undefined) set.state = state;
    if (postalcode !== undefined) set.postalcode = postalcode;
    if (country !== undefined) set.country = country;
    if (profile_picture !== undefined) set.profile_picture = profile_picture;

    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const r = await usuarios.updateOne({ _id: new ObjectId(id_user) }, { $set: set });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });

    const actualizado = await usuarios.findOne({ _id: new ObjectId(id_user) });
    res.json(actualizado);
  });

  app.put('/inventario/addProduct/:id_user', async (req, res) => {
    const { id_user } = req.params;

    const { id_product, stock, unit_price } = req.body;
    const lastRestocked = new Date();
    const newProduct = {
      id_product,
      stock,
      unit_price,
      lastRestocked
    };
    const r = await inventario.updateOne({ id_user: parseInt(id_user) }, { $push: { products: newProduct } });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    const actualizado = await usuarios.findOne({ id_user: parseInt(id_user) });
    res.json(actualizado);
  });

  app.put('/inventario/modifyStock/:id_product', async (req, res) => {
  try {
    const { id_product } = req.params;
    const { id_user, newStock } = req.body;

    if (!id_user || newStock === undefined) {
      return res.status(400).json({ message: "id_user y newStock son requeridos" });
    }

    const result = await inventario.updateOne(
      { id_user: id_user, "products.id_product": Number(id_product) },
      {
        $set: {
          "products.$.stock": newStock,
          "products.$.lastRestocked": new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Producto no encontrado en inventario" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("ERROR modifyStock:", err);
    res.status(500).json({ error: "Error interno" });
  }
});



  // PUT /inventario/:id -> reemplazar / actualizar fields
  app.put('/inventario/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });
      const set = {};
      const { quantity, unit_price } = req.body;
      if (quantity !== undefined) set.quantity = Number(quantity);
      if (unit_price !== undefined) set.unit_price = Number(unit_price);
      set.updatedAt = new Date();
      const r = await inventario.updateOne({ _id: new ObjectId(id) }, { $set: set });
      if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });
      const actualizado = await inventario.findOne({ _id: new ObjectId(id) });
      res.json(actualizado);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al actualizar inventario' });
    }
  });

  // PATCH /inventario/:id -> ajustar cantidad (delta positivo o negativo)
  app.patch('/inventario/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });
      const { delta } = req.body;
      if (delta === undefined) return res.status(400).json({ error: 'delta es obligatorio' });
      const n = Number(delta);
      if (isNaN(n)) return res.status(400).json({ error: 'delta debe ser numérico' });

      // only update if resulting quantity >= 0
      const r = await inventario.findOneAndUpdate(
        { _id: new ObjectId(id), quantity: { $gte: Math.max(0, -n) } }, // ensure enough if decreasing
        { $inc: { quantity: n }, $set: { updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (!r.value) return res.status(400).json({ error: 'No hay stock suficiente o item no encontrado' });
      res.json(r.value);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al ajustar inventario' });
    }
  });



  // PUT /inventario/:id -> reemplazar / actualizar fields
  app.put('/inventario/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });
      const set = {};
      const { quantity, unit_price } = req.body;
      if (quantity !== undefined) set.quantity = Number(quantity);
      if (unit_price !== undefined) set.unit_price = Number(unit_price);
      set.updatedAt = new Date();
      const r = await inventario.updateOne({ _id: new ObjectId(id) }, { $set: set });
      if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });
      const actualizado = await inventario.findOne({ _id: new ObjectId(id) });
      res.json(actualizado);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al actualizar inventario' });
    }
  });

  // PATCH /inventario/:id -> ajustar cantidad (delta positivo o negativo)
  app.patch('/inventario/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });
      const { delta } = req.body;
      if (delta === undefined) return res.status(400).json({ error: 'delta es obligatorio' });
      const n = Number(delta);
      if (isNaN(n)) return res.status(400).json({ error: 'delta debe ser numérico' });

      // only update if resulting quantity >= 0
      const r = await inventario.findOneAndUpdate(
        { _id: new ObjectId(id), quantity: { $gte: Math.max(0, -n) } }, // ensure enough if decreasing
        { $inc: { quantity: n }, $set: { updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (!r.value) return res.status(400).json({ error: 'No hay stock suficiente o item no encontrado' });
      res.json(r.value);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al ajustar inventario' });
    }
  });

  // PUT /productos/:id_product → actualizar (parcial: solo campos enviados)
  app.put('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    if (!ObjectId.isValid(id_product)) return res.status(400).json({ error: 'ID no válido' });

    const { name, description, price } = req.body;
    const set = {};
    if (name !== undefined) set.name = name;
    if (description !== undefined) set.description = description;
    if (price !== undefined) set.price = price;
    if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const r = await productos.updateOne({ _id: new ObjectId(id_product) }, { $set: set });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    const actualizado = await productos.findOne({ _id: new ObjectId(id_product) });
    res.json(actualizado);
  });

  app.put('/mensajes/newMessage/:id_conversation', async (req, res) => {
    const { id_conversation } = req.params;
    const id = parseInt(id_conversation);
    const { from_user, content } = req.body;
    const newMessage = {
      from_user,
      content,
      createdAt: new Date()
    };

    const r = await mensajes.updateOne({ id_conversation: id }, { $push: { messages: newMessage } });
    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    const actualizado = await mensajes.findOne({ id_conversation: id });
    res.json(actualizado);
  });

  // ❌ DELETE /usuarios/:id_user → borrar
  app.delete('/usuarios/:id_user', async (req, res) => {
    const { id_user } = req.params;
    if (!ObjectId.isValid(id_user)) return res.status(400).json({ error: 'ID no válido' });

    const r = await usuarios.deleteOne({ _id: new ObjectId(id_user) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });

    res.status(204).send();
  });

  // DELETE /inventario/:id -> eliminar item de inventario
  app.delete('/inventario/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });
      const r = await inventario.deleteOne({ _id: new ObjectId(id) });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al eliminar inventario' });
    }
  });

  // ❌ DELETE /productos/:id_product → borrar
  app.delete('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    if (!ObjectId.isValid(id_product)) return res.status(400).json({ error: 'ID no válido' });
    const r = await productos.deleteOne({ _id: new ObjectId(id_product) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    res.status(204).send();
  });

  //  DELETE /pedidos/:id_delivery → borrar
  app.delete('/pedidos/:id_delivery', async (req, res) => {
    try {
      const { id_delivery } = req.params;
      const id = parseInt(id_delivery);

      if (isNaN(id)) return res.status(400).json({ error: 'ID no válido' });

      const r = await pedidos.deleteOne({ id_delivery: id });

      if (r.deletedCount === 0)
        return res.status(404).json({ error: 'Pedido no encontrado' });

      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al eliminar el pedido' });
    }
  });

  app.delete('/mensajes/:id_conversation', async (req, res) => {
    try {
      const { id_conversation } = req.params;
      const id = parseInt(id_conversation);
      if (isNaN(id)) return res.status(400).json({ error: 'ID no válido' });

      const r = await mensajes.deleteOne({ id_conversation: id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'Conversación no encontrada' });
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al eliminar la conversación' });
    }
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
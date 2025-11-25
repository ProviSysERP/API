  import express from 'express';
  import { MongoClient, ObjectId } from 'mongodb';
  import cors from 'cors';
  import bcrypt from "bcrypt";
  import jwt from "jsonwebtoken";
  import dotenv from 'dotenv';
  import cookieParser from 'cookie-parser';


  const app = express();
  const port = 3000;

  app.use(express.json());
  // Habilitar CORS para todas las rutas
  app.use(cors({
    origin: "http://localhost:5173", // frontend
    credentials: true
  }));


  // ---- Conexión a Mongo (una sola vez) ----
  const uri = 'mongodb+srv://glu_db_user:8aa8ii1oo1@cluster0.te6deme.mongodb.net/';
  const dbName = 'ProviSys';

  // Clave secreta para JWT
  dotenv.config();
  const ACCESS_EXPIRES_IN = "5m";
  const REFRESH_EXPIRES_IN = "30d";
  const SECRET_ACCESS = process.env.SECRET_ACCESS;
  const SECRET_REFRESH = process.env.SECRET_REFRESH;
  //cookieparser
  app.use(cookieParser());

  // USUARIOS---> APARTADO DE LA API PARA CARGAR DATOS DE USUARIOS
  let usuarios; // colección compartida por las rutas
  let productos; // colección compartida por las rutas
  let posts;
  let proveedores;
  let pedidos;
  let mensajes;
  let inventario;


  async function init() {
    const client = new MongoClient(uri);
    await client.connect();
    console.log(' Conectado a MongoDB');

    const db = client.db(dbName);
    usuarios = db.collection('usuarios');
    productos = db.collection('productos');
    posts = db.collection('posts');
    proveedores = db.collection('proveedores');
    pedidos = db.collection('pedidos');
    mensajes= db.collection('mensajes');
    inventario = db.collection('inventario');

    // Ruta raíz de cortesía
    app.get('/', (req, res) => res.send('API Usuarios activa. Prueba GET /usuarios'));

    // GET /usuarios → listar todos
    app.get('/usuarios', async (req, res) => {
      const docs = await usuarios.find().toArray();
      //console.log(docs);
      res.json(docs);
    });

  // GET /productos -> obtener uno por id_product
  app.get('/productos', async (req, res) => {
    const docs = await productos.find().toArray();
    //console.log(docs);
    res.json(docs);
  });

    app.get('/posts',async (req,res)=>{
      const docs=await posts.find().toArray();
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
    
    app.post('/login', async (req, res) => {
        const { email, password } = req.body;

        // Buscar usuario por name
        const db_user = await usuarios.findOne({ email });
        if (!db_user) return res.status(400).json({ detail: "Correo incorrecto" });

        // Comprobar contraseña
        const passwordMatch = await bcrypt.compare(password, db_user.passwordHash);
        if (!passwordMatch) return res.status(400).json({ detail: "Contraseña incorrecta" });

        //Creamos el payload (header(tipo de codigo(JWT en este caso))) (payload(valores usuario)) (encriptacion(clavesprivadas))
        const payload = { sub: String(db_user.id_user) };
          
        // Creamos accestoken y refreshtoken
        const accessToken = jwt.sign(payload, SECRET_ACCESS, { expiresIn: ACCESS_EXPIRES_IN });
        const refreshToken = jwt.sign(payload, SECRET_REFRESH, { expiresIn: REFRESH_EXPIRES_IN });

        // Guardamos el token refresh en la bd 
        await usuarios.updateOne({ id_user: db_user.id_user }, { $set: { currentRefreshToken: refreshToken } });

        // Devolvemos por cookies el refreshtoken solamente para que no sea accesible de javascript (HTTP ONLY)
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',

          maxAge: 30 * 24 * 60 * 60 * 1000
        });

        // Devolvemos el access token correcto
        res.json({ message: "Login exitoso", access_token: accessToken, token_type: "bearer" });
      });

      app.post('/refresh', async (req, res) => {
          const token = req.cookies?.refreshToken;
          if(!token) return res.status(401).json({ detail: 'no_refresh_token'});

          try {
            const payload = jwt.verify(token, SECRET_REFRESH);

            const user = await usuarios.findOne({ id_user: parseInt(payload.sub) });
            if (!user || user.currentRefreshToken !== token) {
              return res.status(401).json({ detail: 'invalid_refresh' });
            }

            const newAccess = jwt.sign({ sub: payload.sub }, SECRET_ACCESS, { expiresIn: ACCESS_EXPIRES_IN });
            const newRefresh = jwt.sign({ sub: payload.sub }, SECRET_REFRESH, { expiresIn: REFRESH_EXPIRES_IN });
            await usuarios.updateOne({ id_user: parseInt(payload.sub) }, { $set: { currentRefreshToken: newRefresh } });

            res.cookie('refreshToken', newRefresh, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 30 * 24 * 60 * 60 * 1000
            });

            return res.json({ access_token: newAccess, token_type: "bearer" });

          } catch (err) {
            return res.status(401).json({ detail: 'invalid_refresh' });
          }
      });

      app.post('/logout', async (req, res) => {
        const token = req.cookies?.refreshToken;
        if(token) {
          try {
            const payload = jwt.verify(token, SECRET_REFRESH);
            await usuarios.updateOne({ id_user: parseInt(payload.sub) }, { $unset: { currentRefreshToken: "" } });
          } catch (e) {

          }
        }

        res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        return res.json({ message: 'Sesion cerrada' });

      });

      app.get('/usuarios/me', async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No autorizado' });

        // Obtener el token del header "Bearer <token>"
      const token = authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'Token inválido' });

      try {
        const payload = jwt.verify(token, SECRET_ACCESS); // JWT lanzará error si el token no es válido
        const usuario = await usuarios.findOne({ id_user: parseInt(payload.sub) });
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        res.json({ id_user: usuario.id_user });
      } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }
      });

      app.get('/usuarios/:id_user/admin', async (req,res) => {
        const { id_user } = req.params;

        const usuario = await usuarios.findOne({ id_user: parseInt(id_user) });

        if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

        res.json({ admin: usuario.admin == true });
      });

    // GET /usuarios/:id_user → obtener uno por id_user
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

    // GET /productos/:id_product -> obtener uno por id_product
    app.get('/productos/:id_product', async (req, res) => {
      const { id_product } = req.params;
      const id = parseInt(id_product);
      const doc = await productos.findOne({ id_product: id });
      //console.log(doc);
      if (!doc) return res.status(404).json({ error: 'No encontrado' });
      res.json(doc);
    });

    app.get('/productos/porProv/:id_provider', async (req, res) => {
      const { id_provider } = req.params;
      const id = parseInt(id_provider);
      const doc = await productos.findOne({ id_provider: id });
      //console.log(doc);
      if (!doc) return res.status(404).json({ error: 'No encontrado' });
      res.json(doc);
    });

  // POST /Productos → crear
  app.post('/productos', async (req, res) => {
    const { name, description, price, category, images, id_provider } = req.body;
    if (!name || !description || !price) return res.status(400).json({ error: 'Datos faltantes.' });
    const statusProd = "in_stock";
    const createdAt = new Date();
    const updatedAt = new Date();
    const id = await productos.find().sort({ id_product: -1 }).limit(1).toArray();
    const id_product = id.length > 0 ? id[0].id_product + 1 : 1;
    const nuevo = { id_product, id_provider, name, description, category, price, images, statusProd, createdAt, updatedAt };
    const r = await productos.insertOne(nuevo);
    res.status(201).json({ id_product: r.insertedId, ...nuevo });
  });

    // PUT /usuarios/:id_user → actualizar (parcial: solo campos enviados)
    app.put('/usuarios/:id_user', async (req, res) => {
      const { id_user } = req.params;
      const id = parseInt(id_user);

      const { name, email, profile_picture, phone, street, city, state, postalcode, country} = req.body;
      const set = {};
      if (name !== undefined) set.name = name;
      if (email  !== undefined) set.email  = email;
      if (phone !== undefined) set.phone = phone;
      if (street !== undefined) set.street = street;
      if (city !== undefined) set.city = city;
      if (state !== undefined) set.state = state;
      if (postalcode !== undefined) set.postalcode = postalcode;
      if (country !== undefined) set.country = country;
      if (profile_picture !== undefined) set.profile_picture = profile_picture;

      if (Object.keys(set).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

      const r = await usuarios.updateOne({ id_user: id }, { $set: set });
      if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });

      const actualizado = await usuarios.findOne({ id_user: id });
      res.json(actualizado);
    });

    // DELETE /usuarios/:id_user → borrar
    app.delete('/usuarios/:id_user', async (req, res) => {
      const { id_user } = req.params;
      const id = parseInt(id_user);

      const r = await usuarios.deleteOne({ id_user: id });
      if (r.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });

      res.status(204).send();
    });

  // DELETE /productos/:id_product → borrar
  app.delete('/productos/:id_product', async (req, res) => {
    const { id_product } = req.params;
    const id = parseInt(id_product);
    const r = await productos.deleteOne({ id_product: id});
    if (r.deletedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    res.status(204).send();
  });

    app.post('/inventario/create/:id_user', async (req, res) => {
    try {
      const { id_user } = req.params;
      const id = parseInt(id_user);

      if (isNaN(id)) return res.status(400).json({ error: 'id_user inválido' });

      const existing = await inventario.findOne({ id_user: id });
      if (existing) return res.status(400).json({ error: 'El inventario ya existe' });

      const lastInv = await inventario.find().sort({ id_inventory: -1 }).limit(1).toArray();
      const nextIdInventory = lastInv.length > 0 ? lastInv[0].id_inventory + 1 : 1;

      const now = new Date();
      const newInventory = {
        id_inventory: nextIdInventory,
        id_user: id,
        products: [],
        createdAt: now,
        updatedAt: now
      };

      await inventario.insertOne(newInventory);

      res.status(201).json({ message: 'Inventario creado correctamente', inventory: newInventory });

    } catch (err) {
      console.error('Error creando inventario:', err);
      res.status(500).json({ error: 'Error al crear inventario', details: err.message });
    }
  });

  app.put('/inventario/removeProduct/:id_user', async (req, res) => {
    const { id_user } = req.params;
    const { id_product } = req.body;

    const r = await inventario.updateOne(
      { id_user: parseInt(id_user) },
      { $pull: { products: { id_product } } }
    );

    if (r.matchedCount === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'Producto eliminado correctamente' });
  });

    app.get('/inventario/porProveedor/:id_provider', async (req, res) => {
      try {
        const { id_provider } =req.params
        const id = parseInt(id_provider);
        if (isNaN(id_provider)) return res.status(400).json({ error: 'id_provider inválido' });
        const docs = await inventario.findOne({ id_user: id });
        res.json(docs);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener inventario' });
      }
    });

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

  app.get('/mensajes/:id_user', async (req, res) => {

      const { id_user } = req.params;
      const id = parseInt(id_user);
      const doc = await mensajes.find({ $or: [{ user1: id }, { user2: id }] }).toArray();

      if (doc.length === 0) return res.status(404).json({ error: 'No encontrado' });

      res.json(doc);
    });

  app.get('/pedidos', async (req, res) => {
  try {
    const orders = await pedidos.find().toArray();

    // IDs de usuarios, proveedores y productos
    const userIds = [...new Set(orders.map(o => o.id_user))];
    const providerIds = [...new Set(orders.map(o => o.id_provider))];
    const productIds = [
      ...new Set(
        orders.flatMap(o => (o.products || []).map(p => p.id_product))
      )
    ];

    // Obtener datos reales desde la BD
    const users = await usuarios.find({ id_user: { $in: userIds } }).toArray();
    const providers = await proveedores.find({ id_provider: { $in: providerIds } }).toArray();

    // Para productos: considerar que id_product puede ser Number o String
    const productsDb = await productos.find({
      $or: [
        { id_product: { $in: productIds } },
        { _id: { $in: productIds.map(id => {
            try { return new ObjectId(id); } catch { return null; }
          }).filter(Boolean) 
        } }
      ]
    }).toArray();

    // Mapas rápidos
    const userMap = Object.fromEntries(users.map(u => [u.id_user, u.name]));
    const providerMap = Object.fromEntries(providers.map(p => [p.id_provider, p.name]));
    const productMap = Object.fromEntries(productsDb.map(p => [p.id_product ?? p._id.toString(), p.name]));

    // Reemplazar IDs por nombres
    const result = orders.map(order => ({
      ...order,
      user_name: userMap[order.id_user] || "Usuario no encontrado",
      provider_name: providerMap[order.id_provider] || "Proveedor no encontrado",
      products: (order.products || []).map(prod => ({
        ...prod,
        product_name: productMap[prod.id_product] || "Producto no encontrado"
      }))
    }));

    res.json(result);
  } catch (err) {
    console.error("Error obteniendo pedidos:", err);
    res.status(500).json({ error: "Error generando historial de pedidos" });
  }
});




    app.post('/pedidos', async (req, res) => {
    const { id_provider, id_user, products, total_price, address, status } = req.body;
    if (!id_user || !products || !total_price) { return res.status(400).json({ error: 'id_user, products y total_price son obligatorios' });}
    const createdAt = new Date();
    const updatedAt = new Date();
    const nuevo = {id_provider, id_user, products, total_price, address: address || null, status: status || "Pendiente", sent_date: null, received_date: null, createdAt, updatedAt};
    const r = await pedidos.insertOne(nuevo);
    res.status(201).json({id_delivery: r.insertedId, ...nuevo});
  });

    // Arrancar Express
    app.listen(port, () => {
      console.log(` API escuchando en http://localhost:${port}`);
    });
  }

  // Iniciar conexión + rutas
  init().catch(err => {
    console.error(' Error iniciando:', err);
    process.exit(1);
  });
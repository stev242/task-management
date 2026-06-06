import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Hash from '@adonisjs/core/services/hash'

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const data = request.only(['name', 'email', 'password', 'role'])
    
    if (!data.name || !data.email || !data.password) {
      return response.status(400).send({ 
        error: 'Name, email, and password are required' 
      })
    }

    try {
      const user = await User.create({
        name: data.name,
        email: data.email,
        password: await Hash.make(data.password),
        role: data.role || 'user'
      })

      const token = await User.accessTokens.create(user)

      return response.status(201).send({ 
        message: 'User registered successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token: token.value!.release() 
      })
    } catch (error: any) {
      return response.status(400).send({ 
        error: 'Registration failed',
        details: error.message 
      })
    }
  }

  async login({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])
    
    if (!email || !password) {
      return response.status(400).send({ 
        error: 'Email and password are required' 
      })
    }

    const user = await User.findBy('email', email)
    
    if (!user || !(await Hash.verify(user.password, password))) {
      return response.status(401).send({ 
        error: 'Invalid credentials' 
      })
    }

    const token = await User.accessTokens.create(user)

    return response.send({ 
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token: token.value!.release() 
    })
  }
}
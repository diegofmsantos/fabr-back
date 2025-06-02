import express from 'express'
import { timeRouter } from './time'
import { jogadorRouter } from './jogador'
import { materiaRouter } from './materia'
import { adminRouter } from './admin'

export const mainRouter = express.Router()

mainRouter.use('/times', timeRouter)
mainRouter.use('/jogadores', jogadorRouter)
mainRouter.use('/materias', materiaRouter)
mainRouter.use('/admin', adminRouter)
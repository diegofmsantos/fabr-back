import { PrismaClient } from '@prisma/client'
import express from 'express'

const prisma = new PrismaClient()

export const materiaRouter = express.Router()

materiaRouter.get('/materias', async (req, res) => {
    try {
        const materias = await prisma.materia.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.status(200).json(materias)
    } catch (error) {
        console.error('Erro ao buscar as matérias:', error)
        res.status(500).json({ error: 'Erro ao buscar as matérias' })
    }
})

materiaRouter.post('/materias', async (req, res) => {
    try {
        const materiaData = req.body;

        const createdMateria = await prisma.materia.create({
            data: {
                titulo: materiaData.titulo,
                subtitulo: materiaData.subtitulo,
                imagem: materiaData.imagem,
                legenda: materiaData.legenda,
                texto: materiaData.texto,
                autor: materiaData.autor,
                autorImage: materiaData.autorImage,
                createdAt: new Date(materiaData.createdAt),
                updatedAt: new Date(materiaData.updatedAt)
            }
        });

        res.status(201).json(createdMateria);
    } catch (error) {
        console.error('Erro ao criar matéria:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

materiaRouter.put('/materias/:id', async (req, res) => {
    const { id } = req.params;
    const materiaData = req.body;

    try {
        const updatedMateria = await prisma.materia.update({
            where: { id: parseInt(id) },
            data: {
                ...materiaData,
                createdAt: new Date(materiaData.createdAt),
                updatedAt: new Date(materiaData.updatedAt)
            }
        });

        res.status(200).json(updatedMateria);
    } catch (error) {
        console.error('Erro ao atualizar matéria:', error);
        res.status(500).json({ error: 'Erro ao atualizar matéria' });
    }
});

materiaRouter.delete('/materia/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10)

        if (isNaN(id)) {
            res.status(400).json({ error: "ID inválido" })
            return
        }

        const existingMateria = await prisma.materia.findUnique({
            where: { id }
        })
        if (!existingMateria) {
            res.status(404).json({ error: "Matéria não encontrada" })
            return
        }

        await prisma.materia.delete({
            where: { id }
        })

        res.status(200).json({ message: "Matéria excluída com sucesso!" })
    } catch (error) {
        console.error("Erro ao excluir matéria:", error)
        res.status(500).json({ error: "Erro ao excluir matéria" })
    }
})
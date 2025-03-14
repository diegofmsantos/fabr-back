import { PrismaClient } from '@prisma/client'
import express, { Request, Response } from 'express'
import { TimeSchema } from '../schemas/Time'
import { JogadorSchema } from '../schemas/Jogador'
import { Times } from '../data/times'

const prisma = new PrismaClient()

export const mainRouter = express.Router()

// Rota para obter todos os times com seus jogadores
mainRouter.get('/times', async (req, res) => {
    console.log('Rota /api/times chamada')
    try {
        const times = await prisma.time.findMany({
            include: { jogadores: true },
        });
        res.status(200).json(times)
    } catch (error) {
        console.error('Erro ao buscar os times:', error)
        res.status(500).json({ error: 'Erro ao buscar os times' })
    }
})

// Rota para adicionar um único time e seus jogadores
mainRouter.post('/time', async (req, res) => {
    try {
        const teamData = TimeSchema.parse(req.body)

        // Criação do time sem permitir campos `undefined`
        const createdTeam = await prisma.time.create({
            data: {
                nome: teamData.nome || '',
                sigla: teamData.sigla || '',
                cor: teamData.cor || '',
                cidade: teamData.cidade || '',
                bandeira_estado: teamData.bandeira_estado || '',
                fundacao: teamData.fundacao || '',
                logo: teamData.logo || '',
                capacete: teamData.capacete || '',
                instagram: teamData.instagram || '',
                instagram2: teamData.instagram2 || '',
                estadio: teamData.estadio || '',
                presidente: teamData.presidente || '',
                head_coach: teamData.head_coach || '',
                instagram_coach: teamData.instagram_coach || '',
                coord_ofen: teamData.coord_ofen || '',
                coord_defen: teamData.coord_defen || '',
                titulos: teamData.titulos || [],
            },
        })

        // Criação dos jogadores, sem permitir campos `undefined`
        if (teamData.jogadores && teamData.jogadores.length > 0) {
            await prisma.jogador.createMany({
                data: teamData.jogadores.map((player) => ({
                    nome: player.nome || '',
                    timeFormador: player.timeFormador || '',
                    posicao: player.posicao || '',
                    setor: player.setor || 'Ataque',
                    experiencia: player.experiencia || 0,
                    numero: player.numero || 0,
                    idade: player.idade || 0,
                    altura: player.altura || 0,
                    peso: player.peso || 0,
                    instagram: player.instagram || '',
                    instagram2: player.instagram2 || '',
                    cidade: player.cidade || '',
                    nacionalidade: player.nacionalidade || '',
                    camisa: player.camisa || '',
                    estatisticas: player.estatisticas || {},
                    timeId: createdTeam.id,
                })),
                skipDuplicates: true,
            })
        }

        res.status(201).json({
            team: createdTeam,
            players: teamData.jogadores?.length ? 'Jogadores criados' : 'Nenhum jogador adicionado',
        })
    } catch (error) {
        console.error('Erro ao criar time e jogadores:', error)
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        })
    }
})

// Rota para atualizar informações de um time
mainRouter.put('/time/:id', async (req, res) => {
    const { id } = req.params

    try {
        // Remove o campo 'id' do objeto antes de enviar para o Prisma
        const timeData = TimeSchema.parse(req.body) // Valida os dados recebidos
        const { id: _, jogadores, ...updateData } = timeData // Remove campos indesejados como 'id' ou relações

        const updatedTime = await prisma.time.update({
            where: { id: parseInt(id) }, // Identifica o time pelo ID
            data: updateData, // Atualiza apenas os campos válidos
        })

        res.status(200).json(updatedTime)
    } catch (error) {
        console.error('Erro ao atualizar o time:', error)
        res.status(500).json({ error: 'Erro ao atualizar o time' })
    }
})

//Rota para deletar um time
mainRouter.delete('/time/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
        // Extrai o ID do time dos parâmetros da URL
        const id = parseInt(req.params.id, 10)

        // Verifica se o ID é válido
        if (isNaN(id)) {
            res.status(400).json({ error: "ID inválido" })
            return
        }

        // Verifica se o time existe no banco de dados
        const existingTime = await prisma.time.findUnique({
            where: { id },
        })

        if (!existingTime) {
            res.status(404).json({ error: "Time não encontrado" })
            return
        }

        // Deleta o time do banco de dados
        await prisma.time.delete({
            where: { id },
        })

        // Retorna uma mensagem de sucesso
        res.status(200).json({ message: "Time excluído com sucesso!" })
    } catch (error) {
        console.error("Erro ao excluir time:", error)
        res.status(500).json({ error: "Erro ao excluir time" })
    }
})

// Rota para obter todos os jogadores
mainRouter.get('/jogadores', async (req, res) => {
    try {
        const jogadores = await prisma.jogador.findMany({
            include: {
                time: true,
            },
            orderBy: {
                numero: 'asc'
            }
        })

        res.status(200).json(jogadores)
    } catch (error) {
        console.error('Erro ao buscar os jogadores:', error)
        res.status(500).json({ error: 'Erro ao buscar os jogadores' })
    }
})

// Rota para adicionar um jogador a um time existente
mainRouter.post('/jogador', async (req, res) => {
    try {
        const jogadorData = JogadorSchema.parse(req.body)

        if (typeof jogadorData.timeId !== 'number') {
            throw new Error('O campo "timeId" é obrigatório e deve ser um número.')
        }

        const estatisticas = jogadorData.estatisticas ? jogadorData.estatisticas : {}

        const { id, time, ...jogadorDataWithoutIdAndTime } = jogadorData

        const jogadorCriado = await prisma.jogador.create({
            data: {
                ...jogadorDataWithoutIdAndTime,
                nome: jogadorData.nome ?? '',
                posicao: jogadorData.posicao ?? '',
                setor: jogadorData.setor ?? 'Ataque',
                experiencia: jogadorData.experiencia ?? 0,
                numero: jogadorData.numero ?? 0,
                idade: jogadorData.idade ?? 0,
                altura: jogadorData.altura ?? 0,
                peso: jogadorData.peso ?? 0,
                instagram: jogadorData.instagram ?? '',
                instagram2: jogadorData.instagram2 ?? '',
                cidade: jogadorData.cidade ?? '',
                nacionalidade: jogadorData.nacionalidade ?? '',
                camisa: jogadorData.camisa ?? '',
                estatisticas: estatisticas,
                timeFormador: jogadorData.timeFormador ?? '',
                timeId: jogadorData.timeId,
            },
        })

        res.status(201).json({ jogador: jogadorCriado })
    } catch (error) {
        console.error('Erro ao criar o jogador:', error)
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        })
    }
})

// Rota para atualizar um jogador
mainRouter.put('/jogador/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
        console.log("Iniciando atualização do jogador...")

        // Valida o ID da URL
        const id = parseInt(req.params.id, 10)
        if (isNaN(id)) {
            console.warn("ID inválido recebido:", req.params.id)
            res.status(400).json({ error: "ID inválido" })
            return;
        }
        console.log("ID validado:", id)

        // Captura e filtra os dados do corpo da requisição
        const jogadorData = req.body
        console.log("Dados recebidos no corpo da requisição:", jogadorData)

        const { estatisticas, ...restData } = jogadorData

        // Converte campos numéricos para o tipo correto
        const numericFields = ["experiencia", "idade", "altura", "peso"]
        for (const field of numericFields) {
            if (restData[field] !== undefined) {
                restData[field] = Number(restData[field])
            }
        }

        // Remove campos inválidos das estatísticas
        const filteredEstatisticas = estatisticas
            ? Object.fromEntries(
                Object.entries(estatisticas).map(([group, stats]) => [
                    group,
                    Object.fromEntries(
                        Object.entries(stats || {}).filter(
                            ([_, value]) => value !== undefined && value !== ""
                        )
                    ),
                ])
            )
            : {};
        console.log("Estatísticas filtradas:", filteredEstatisticas)

        const filteredData = {
            ...restData,
            estatisticas: filteredEstatisticas,
        };
        console.log("Dados finais para atualização:", filteredData)

        const updatedJogador = await prisma.jogador.update({
            where: { id },
            data: filteredData,
        })
        console.log("Jogador atualizado com sucesso:", updatedJogador)

        res.status(200).json(updatedJogador)
    } catch (error) {
        console.error("Erro ao atualizar o jogador:", error)
        res.status(500).json({ error: "Erro ao atualizar o jogador" })
    }
})

// Rota para deletar um jogador
mainRouter.delete('/jogador/:id', async (req: Request<{ id: string }>, res: Response) => {
    console.log(`DELETE request received for ID: ${req.params.id}`)
    try {
        const id = parseInt(req.params.id, 10)

        if (isNaN(id)) {
            console.log("Invalid ID provided")
            res.status(400).json({ error: "ID inválido" })
            return
        }

        await prisma.jogador.delete({
            where: { id },
        })

        console.log(`Jogador com ID ${id} excluído com sucesso.`)
        res.status(200).json({ message: "Jogador excluído com sucesso!" })
    } catch (error) {
        console.error("Erro ao excluir jogador:", error)
        res.status(500).json({ error: "Erro ao excluir jogador" })
    }
})

// Rota para obter todas as matérias
mainRouter.get('/materias', async (req, res) => {
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

// Rota para criar matéria
mainRouter.post('/materias', async (req, res) => {
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

// Rota para atualizar matéria
mainRouter.put('/materias/:id', async (req, res) => {
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

// Rota para deletar uma matéria
mainRouter.delete('/materia/:id', async (req, res) => {
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

// Rota para adicionar todos os dados de uma só vez
mainRouter.post('/importar-dados', async (req, res) => {
    try {
        const teamsData = Times

        const createdTeams = await Promise.all(
            teamsData.map(async (teamData) => {
                const createdTeam = await prisma.time.create({
                    data: {
                        nome: teamData.nome || '',
                        sigla: teamData.sigla || '',
                        cor: teamData.cor || '',
                        cidade: teamData.cidade || '',
                        bandeira_estado: teamData.bandeira_estado || '',
                        fundacao: teamData.fundacao || '',
                        logo: teamData.logo || '',
                        capacete: teamData.capacete || '',
                        instagram: teamData.instagram || '',
                        instagram2: teamData.instagram2 || '',
                        estadio: teamData.estadio || '',
                        presidente: teamData.presidente || '',
                        head_coach: teamData.head_coach || '',
                        instagram_coach: teamData.instagram_coach || '',
                        coord_ofen: teamData.coord_ofen || '',
                        coord_defen: teamData.coord_defen || '',
                        titulos: teamData.titulos || [],
                    },
                })

                if (teamData.jogadores && teamData.jogadores.length > 0) {
                    const players = teamData.jogadores.map((player) => ({
                        nome: player.nome || '',
                        timeFormador: player.timeFormador || '',
                        posicao: player.posicao || '',
                        setor: player.setor || 'Ataque',
                        experiencia: player.experiencia || 0,
                        numero: player.numero || 0,
                        idade: player.idade || 0,
                        altura: player.altura || 0,
                        peso: player.peso || 0,
                        instagram: player.instagram || '',
                        instagram2: player.instagram2 || '',
                        cidade: player.cidade || '',
                        nacionalidade: player.nacionalidade || '',
                        camisa: player.camisa || '',
                        estatisticas: player.estatisticas || {},
                        timeId: createdTeam.id,
                    }))

                    await prisma.jogador.createMany({
                        data: players,
                        skipDuplicates: true,
                    })
                }

                return createdTeam;
            })
        )

        res.status(201).json({ message: 'Dados importados com sucesso!', teams: createdTeams })
    } catch (error) {
        console.error('Erro ao importar os dados:', error)
        res.status(500).json({ error: 'Erro ao importar os dados' })
    }
})















import { PrismaClient } from '@prisma/client'
import express, { Request, Response } from 'express'
import { TimeSchema } from '../schemas/Time'
import { JogadorSchema } from '../schemas/Jogador'
import { Times } from '../data/times'
import fs from 'fs';
import path from 'path';
import multer from 'multer'
import xlsx from 'xlsx'

const prisma = new PrismaClient()

export const mainRouter = express.Router()

// Configuração do multer para upload de arquivos (adicionar após as importações existentes)
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        if (
            file.mimetype === 'application/vnd.ms-excel' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});


// Rota para obter todos os times com seus jogadores, com filtro opcional de temporada
mainRouter.get('/times', async (req, res) => {
    console.log('Rota /api/times chamada')
    try {
        const { temporada } = req.query
        const temporadaFiltro = temporada ? String(temporada) : '2024'

        const times = await prisma.time.findMany({
            where: { temporada: temporadaFiltro },
            include: {
                jogadores: {
                    where: { temporada: temporadaFiltro },
                    include: { jogador: true }
                },
            },
        });

        // Transformar os dados e fazer parse dos títulos
        const timesFormatados = times.map(time => {
            // Parse dos títulos se for string
            let titulosParsed = time.titulos;
            
            if (typeof time.titulos === 'string') {
                try {
                    titulosParsed = JSON.parse(time.titulos);
                    console.log(`Títulos parseados para ${time.nome}:`, titulosParsed);
                } catch (error) {
                    console.error(`Erro ao fazer parse dos títulos para ${time.nome}:`, error);
                    // Fallback para estrutura padrão
                    titulosParsed = [{ nacionais: "0", conferencias: "0", estaduais: "0" }];
                }
            }
            
            return {
                ...time,
                titulos: titulosParsed, // Usar títulos parseados
                jogadores: time.jogadores.map(jt => ({
                    ...jt.jogador,
                    numero: jt.numero,
                    camisa: jt.camisa,
                    estatisticas: jt.estatisticas,
                    timeId: time.id,
                    temporada: jt.temporada
                }))
            };
        });

        res.status(200).json(timesFormatados)
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
                temporada: teamData.temporada || '2024', // Adiciona temporada com valor padrão
            },
        })

        // Criação dos jogadores e seus vínculos com times
        if (teamData.jogadores && teamData.jogadores.length > 0) {
            for (const player of teamData.jogadores) {
                // Primeiro, cria o jogador
                const jogadorCriado = await prisma.jogador.create({
                    data: {
                        nome: player.nome || '',
                        timeFormador: player.timeFormador || '',
                        posicao: player.posicao || '',
                        setor: player.setor || 'Ataque',
                        experiencia: player.experiencia || 0,
                        idade: player.idade || 0,
                        altura: player.altura || 0,
                        peso: player.peso || 0,
                        instagram: player.instagram || '',
                        instagram2: player.instagram2 || '',
                        cidade: player.cidade || '',
                        nacionalidade: player.nacionalidade || '',
                    },
                })

                // Depois, cria o vínculo entre jogador e time
                await prisma.jogadorTime.create({
                    data: {
                        jogadorId: jogadorCriado.id,
                        timeId: createdTeam.id,
                        temporada: teamData.temporada || '2024',
                        numero: player.numero || 0,
                        camisa: player.camisa || '',
                        estatisticas: player.estatisticas || {},
                    },
                })
            }
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

        // Primeiro, exclui todos os vínculos de jogadores com esse time
        await prisma.jogadorTime.deleteMany({
            where: { timeId: id },
        })

        // Depois, deleta o time do banco de dados
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

mainRouter.get('/jogadores', async (req, res) => {
    try {
        const {
            temporada = '2024',
            timeId,
            includeAllTemporadas = false
        } = req.query;

        console.log('Parâmetros recebidos na busca de jogadores:', {
            temporada,
            timeId,
            includeAllTemporadas
        });

        // Configurações de filtro base
        const whereCondition: any = {
            temporada: String(temporada)
        };

        // Adicionar filtro de time se fornecido
        if (timeId) {
            whereCondition.timeId = parseInt(String(timeId));
        }

        // Buscar vínculos de jogadores com suas informações
        const jogadoresTimesQuery = await prisma.jogadorTime.findMany({
            where: whereCondition,
            include: {
                jogador: true,
                time: true
            },
            orderBy: [
                { numero: 'asc' },
                { jogador: { nome: 'asc' } }
            ]
        });

        // Tratamento de dados para formato consistente
        const jogadoresFormatados = jogadoresTimesQuery.map(jt => ({
            ...jt.jogador,
            numero: jt.numero,
            camisa: jt.camisa,
            estatisticas: jt.estatisticas || {},
            timeId: jt.timeId,
            time: jt.time ? {
                id: jt.time.id,
                nome: jt.time.nome,
                sigla: jt.time.sigla,
                cor: jt.time.cor
            } : null,
            temporada: jt.temporada
        }));

        // Se solicitado, incluir jogadores de outras temporadas
        if (includeAllTemporadas === 'true' && !timeId) {
            // Buscar todas as temporadas do jogador
            const jogadoresTodasTemporadas = await prisma.jogadorTime.findMany({
                where: {
                    jogadorId: { in: jogadoresFormatados.map(j => j.id) }
                },
                include: {
                    jogador: true,
                    time: true
                },
                distinct: ['jogadorId', 'temporada']
            });

            // Adicionar informações de outras temporadas
            jogadoresFormatados.forEach(jogador => { // @ts-ignore
                jogador.historicoTemporadas = jogadoresTodasTemporadas
                    .filter(jt => jt.jogadorId === jogador.id)
                    .map(jt => ({
                        temporada: jt.temporada,
                        time: jt.time ? {
                            id: jt.time.id,
                            nome: jt.time.nome,
                            sigla: jt.time.sigla
                        } : null
                    }));
            });
        }

        console.log(`Jogadores encontrados: ${jogadoresFormatados.length}`);

        res.status(200).json(jogadoresFormatados);
    } catch (error) {
        console.error('Erro na rota de jogadores:', error);
        res.status(500).json({
            error: 'Erro ao buscar jogadores',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});


mainRouter.get('/jogador/:id/temporada/:ano', async (req: Request, res: Response) => {
    try {
        const { id, ano } = req.params;
        const jogadorId = parseInt(id, 10);

        if (isNaN(jogadorId)) {
            res.status(400).json({ error: 'ID do jogador inválido' });
            return; // **Adicionado para evitar execução contínua**
        }

        const jogadorTime = await prisma.jogadorTime.findFirst({
            where: {
                jogadorId,
                temporada: ano,
            },
            include: {
                jogador: true,
                time: true,
            },
        });

        if (!jogadorTime) {
            res.status(404).json({ error: 'Jogador não encontrado nesta temporada' });
            return; // **Adicionado para evitar execução contínua**
        }

        res.status(200).json({
            jogador: jogadorTime.jogador,
            time: jogadorTime.time,
            estatisticas: jogadorTime.estatisticas,
            numero: jogadorTime.numero,
            camisa: jogadorTime.camisa,
        });
        return; // **Garantindo que a execução pare aqui**

    } catch (error) {
        console.error('Erro ao buscar jogador:', error);
        res.status(500).json({ error: 'Erro ao buscar jogador' });
        return; // **Finalizando o fluxo no catch**
    }
});

// Rota para adicionar um jogador a um time
mainRouter.post('/jogador', async (req, res) => {
    try {
        const { temporada = '2024', ...jogadorRawData } = req.body;
        const jogadorData = JogadorSchema.parse(jogadorRawData);

        const estatisticas = jogadorData.estatisticas ?? {};

        // Verifica se timeId foi fornecido
        if (!jogadorData.timeId) {
            res.status(400).json({ error: 'O campo "timeId" é obrigatório.' });
            return;
        }

        // Verifica se o time existe
        const timeExiste = await prisma.time.findUnique({
            where: { id: jogadorData.timeId }
        });

        if (!timeExiste) {
            res.status(404).json({ error: 'Time não encontrado.' });
            return;
        }

        // Primeiro, cria o jogador
        const jogadorCriado = await prisma.jogador.create({
            data: {
                nome: jogadorData.nome ?? '',
                posicao: jogadorData.posicao ?? '',
                setor: jogadorData.setor ?? 'Ataque',
                experiencia: jogadorData.experiencia ?? 0,
                idade: jogadorData.idade ?? 0,
                altura: jogadorData.altura ?? 0,
                peso: jogadorData.peso ?? 0,
                instagram: jogadorData.instagram ?? '',
                instagram2: jogadorData.instagram2 ?? '',
                cidade: jogadorData.cidade ?? '',
                nacionalidade: jogadorData.nacionalidade ?? '',
                timeFormador: jogadorData.timeFormador ?? '',
            },
        });

        // Depois, cria o vínculo do jogador com o time na temporada
        const jogadorTimeVinculo = await prisma.jogadorTime.create({
            data: {
                jogadorId: jogadorCriado.id,
                timeId: jogadorData.timeId,
                temporada: String(temporada),
                numero: jogadorData.numero ?? 0,
                camisa: jogadorData.camisa ?? '',
                estatisticas: estatisticas,
            }
        });

        res.status(201).json({
            jogador: jogadorCriado,
            vinculo: jogadorTimeVinculo
        });
    } catch (error) {
        console.error('Erro ao criar o jogador:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
    }
});

// Rota para atualizar um jogador
mainRouter.put('/jogador/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
        // Valida o ID da URL
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            res.status(400).json({ error: "ID inválido" });
            return;
        }

        // Clone o body e remova os campos que não devem ir para o update do jogador
        const { estatisticas, numero, camisa, timeId, temporada, id: bodyId, ...dadosJogador } = req.body;

        console.log("Valor de camisa recebido:", camisa);

        // Garanta que campos numéricos sejam números
        if (dadosJogador.altura !== undefined) {
            dadosJogador.altura = Number(String(dadosJogador.altura).replace(',', '.'));
        }
        if (dadosJogador.peso !== undefined) dadosJogador.peso = Number(dadosJogador.peso);
        if (dadosJogador.idade !== undefined) dadosJogador.idade = Number(dadosJogador.idade);
        if (dadosJogador.experiencia !== undefined) dadosJogador.experiencia = Number(dadosJogador.experiencia);

        // Atualiza os dados básicos do jogador
        const updatedJogador = await prisma.jogador.update({
            where: { id },
            data: dadosJogador,  // Atualiza todos os dados básicos
        });

        // Atualiza o vínculo jogador-time se fornecido temporada e timeId
        if (temporada && timeId) {
            // Busca o vínculo existente
            const vinculoExistente = await prisma.jogadorTime.findFirst({
                where: {
                    jogadorId: id,
                    timeId: parseInt(String(timeId)),
                    temporada: temporada,
                }
            });

            if (vinculoExistente) {
                // Se camisa for passada, ela será atualizada, caso contrário, mantém o valor existente
                const updateData = {
                    numero: numero !== undefined ? parseInt(String(numero)) : vinculoExistente.numero,
                    camisa: camisa !== undefined ? camisa : vinculoExistente.camisa,  // Atualização da camisa
                    estatisticas: estatisticas || vinculoExistente.estatisticas,
                };

                console.log("Atualizando vínculo com camisa:", updateData.camisa);

                // Atualiza o vínculo existente com os dados corretos
                const vinculoAtualizado = await prisma.jogadorTime.update({
                    where: { id: vinculoExistente.id },
                    data: updateData,
                });

                // Verifica se a atualização foi feita
                console.log("Camisa após atualização:", vinculoAtualizado.camisa);
            } else {
                // Cria um novo vínculo se não existir
                await prisma.jogadorTime.create({
                    data: {
                        jogadorId: id,
                        timeId: parseInt(String(timeId)),
                        temporada: temporada,
                        numero: numero !== undefined ? parseInt(String(numero)) : 0,
                        camisa: camisa || '',  // Garante que camisa será armazenada
                        estatisticas: estatisticas || {},
                    }
                });
            }
        }

        // Retornar o jogador com seus vínculos
        const jogadorComVinculos = await prisma.jogador.findUnique({
            where: { id },
            include: {
                times: {
                    where: {
                        timeId: timeId ? parseInt(String(timeId)) : undefined,
                        temporada: temporada || undefined,
                    },
                    select: {
                        id: true,
                        temporada: true,
                        numero: true,
                        camisa: true, // Campo camisa para retornar no resultado
                        estatisticas: true,
                        time: true // se quiser trazer o time relacionado
                    }
                }
            }
        });

        res.status(200).json(jogadorComVinculos);
    } catch (error) {
        console.error("Erro ao atualizar o jogador:", error);
        res.status(500).json({ error: "Erro ao atualizar o jogador" });
    }
});



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

// Rota para importar dados do arquivo Times
mainRouter.post('/importar-dados', async (req, res) => {
    try {
        const teamsData = Times
        const createdTeams = []

        for (const teamData of teamsData) {
            // Cria o time
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
                    temporada: teamData.temporada || '2024',
                },
            })

            createdTeams.push(createdTeam)

            // Cria os jogadores e seus vínculos
            if (teamData.jogadores && teamData.jogadores.length > 0) {
                for (const player of teamData.jogadores) {
                    // Primeiro, cria o jogador
                    const jogadorCriado = await prisma.jogador.create({
                        data: {
                            nome: player.nome || '',
                            timeFormador: player.timeFormador || '',
                            posicao: player.posicao || '',
                            setor: player.setor || 'Ataque',
                            experiencia: player.experiencia || 0,
                            idade: player.idade || 0,
                            altura: player.altura || 0,
                            peso: player.peso || 0,
                            instagram: player.instagram || '',
                            instagram2: player.instagram2 || '',
                            cidade: player.cidade || '',
                            nacionalidade: player.nacionalidade || '',
                        },
                    })

                    // Depois, cria o vínculo entre jogador e time
                    await prisma.jogadorTime.create({
                        data: {
                            jogadorId: jogadorCriado.id,
                            timeId: createdTeam.id,
                            temporada: teamData.temporada || '2024',
                            numero: player.numero || 0,
                            camisa: player.camisa || '',
                            estatisticas: player.estatisticas || {},
                        },
                    })
                }
            }
        }

        res.status(201).json({ message: 'Dados importados com sucesso!', teams: createdTeams.length })
    } catch (error) {
        console.error('Erro ao importar os dados:', error)
        res.status(500).json({ error: 'Erro ao importar os dados' })
    }
})

// Rota para obter transferências a partir do arquivo JSON
mainRouter.get('/transferencias-json', (req: Request, res: Response) => {
    try {
        const temporadaOrigem = req.query.temporadaOrigem as string;
        const temporadaDestino = req.query.temporadaDestino as string;

        // Validar parâmetros
        if (!temporadaOrigem || !temporadaDestino) {
            res.status(400).json({
                error: 'Parâmetros temporadaOrigem e temporadaDestino são obrigatórios'
            });
            return;
        }

        // Caminho para o arquivo JSON
        const filePath = path.join(process.cwd(), 'public', 'data',
            `transferencias_${temporadaOrigem}_${temporadaDestino}.json`);

        console.log(`Buscando arquivo de transferências: ${filePath}`);

        // Verificar se o arquivo existe
        if (!fs.existsSync(filePath)) {
            console.log(`Arquivo de transferências não encontrado: ${filePath}`);
            res.status(404).json({
                error: `Não foram encontradas transferências de ${temporadaOrigem} para ${temporadaDestino}`
            });
            return;
        }

        // Ler o conteúdo do arquivo
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // Processar o JSON
            try {
                const transferencias = JSON.parse(fileContent);
                res.status(200).json(transferencias);
            } catch (parseError) {
                console.error('Erro ao fazer parse do JSON:', parseError);
                res.status(500).json({ error: 'Arquivo de transferências está corrompido' });
            }
        } catch (readError) {
            console.error('Erro ao ler arquivo:', readError);
            res.status(500).json({ error: 'Erro ao ler arquivo de transferências' });
        }
    } catch (error) {
        console.error('Erro geral ao buscar transferências:', error);
        res.status(500).json({ error: 'Erro ao buscar transferências' });
    }
});

// Rota para iniciar nova temporada
mainRouter.post('/iniciar-temporada/:ano', async (req, res) => {
    const result = await prisma.$transaction(async (tx) => {
        try {
            const { ano } = req.params;
            const anoAnterior = (parseInt(ano) - 1).toString();

            interface TimeChange {
                timeId: number;
                nome?: string;
                sigla?: string;
                cor?: string;
                instagram?: string;
                instagram2?: string;
                logo?: string;
                capacete?: string;
                presidente?: string;
                head_coach?: string;
                instagram_coach?: string
                coord_ofen?: string;
                coord_defen?: string;
            }

            interface Transferencia {
                jogadorId: number;
                jogadorNome?: string;
                timeOrigemId?: number;
                timeOrigemNome?: string;
                novoTimeId: number;
                novoTimeNome?: string;
                novaPosicao?: string;
                novoSetor?: string;
                novoNumero?: number;
                novaCamisa?: string;
            }

            const timesAnoAnterior = await tx.time.findMany({
                where: { temporada: anoAnterior },
            });

            if (timesAnoAnterior.length === 0) {
                throw new Error(`Nenhum time encontrado na temporada ${anoAnterior}`);
            }

            const mapeamentoIds = new Map();
            const mapeamentoNomes = new Map();

            const timesNovos = [];
            for (const time of timesAnoAnterior) {
                const timeId = time.id;
                const nomeAntigo = time.nome;

                const timeChanges: TimeChange[] = req.body.timeChanges || [];
                const timeChange = timeChanges.find((tc: TimeChange) => tc.timeId === timeId);

                const nomeNovo = timeChange?.nome || time.nome;

                const novoTime = await tx.time.create({
                    data: {
                        nome: nomeNovo,
                        sigla: timeChange?.sigla || time.sigla,
                        cor: timeChange?.cor || time.cor,
                        cidade: time.cidade,
                        bandeira_estado: time.bandeira_estado,
                        fundacao: time.fundacao,
                        logo: timeChange?.logo || time.logo,
                        capacete: timeChange?.capacete || time.capacete,
                        instagram: timeChange?.instagram || time.instagram,
                        instagram2: timeChange?.instagram2 || time.instagram2,
                        estadio: time.estadio,
                        presidente: timeChange?.presidente || time.presidente,
                        head_coach: timeChange?.head_coach || time.head_coach,
                        instagram_coach: time.instagram_coach,
                        coord_ofen: timeChange?.coord_ofen || time.coord_ofen,
                        coord_defen: timeChange?.coord_defen || time.coord_defen,
                        titulos: time.titulos as any,
                        temporada: ano,
                    },
                });

                mapeamentoIds.set(timeId, novoTime.id);

                if (nomeAntigo !== nomeNovo) {
                    mapeamentoNomes.set(nomeAntigo, {
                        novoNome: nomeNovo,
                        novoId: novoTime.id
                    });
                }

                timesNovos.push(novoTime);
            }

            const jogadoresTimesAnoAnterior = await tx.jogadorTime.findMany({
                where: { temporada: anoAnterior },
                include: { jogador: true, time: true },
            });

            const jogadoresProcessados = new Set<number>();

            const transferencias = req.body.transferencias || [];

            for (const transferencia of transferencias) {
                try {
                    const jogadorId = transferencia.jogadorId;

                    if (jogadoresProcessados.has(jogadorId)) {
                        continue;
                    }

                    const jogador = await tx.jogador.findUnique({
                        where: { id: jogadorId }
                    });

                    if (!jogador) {
                        continue;
                    }

                    const relacaoAtual = await tx.jogadorTime.findFirst({
                        where: {
                            jogadorId: jogadorId,
                            temporada: anoAnterior
                        },
                        include: { time: true }
                    });

                    if (!relacaoAtual) {
                        continue;
                    }

                    let timeDestino = null;

                    if (transferencia.novoTimeId) {
                        const novoId = mapeamentoIds.get(transferencia.novoTimeId);
                        if (novoId) {
                            timeDestino = await tx.time.findUnique({
                                where: { id: novoId }
                            });
                        }
                    }

                    if (!timeDestino && transferencia.novoTimeNome) {
                        timeDestino = await tx.time.findFirst({
                            where: {
                                nome: transferencia.novoTimeNome,
                                temporada: ano
                            }
                        });

                        if (timeDestino) {
                        }
                    }

                    if (!timeDestino && transferencia.novoTimeNome) {
                        for (const [antigo, info] of mapeamentoNomes.entries()) {
                            if (info.novoNome === transferencia.novoTimeNome) {
                                timeDestino = await tx.time.findUnique({
                                    where: { id: info.novoId }
                                });
                                if (timeDestino) {
                                    break;
                                }
                            }
                        }
                    }

                    if (!timeDestino) {
                        continue;
                    }

                    if (transferencia.novaPosicao || transferencia.novoSetor) {
                        const dadosAtualizacao: { posicao?: string, setor?: string } = {};

                        if (transferencia.novaPosicao) dadosAtualizacao.posicao = transferencia.novaPosicao;
                        if (transferencia.novoSetor) dadosAtualizacao.setor = transferencia.novoSetor;

                        await tx.jogador.update({
                            where: { id: jogadorId },
                            data: dadosAtualizacao
                        });
                    }

                    const novoVinculo = await tx.jogadorTime.create({
                        data: {
                            jogadorId: jogadorId,
                            timeId: timeDestino.id,
                            temporada: ano,
                            numero: transferencia.novoNumero || relacaoAtual.numero,
                            camisa: transferencia.novaCamisa || relacaoAtual.camisa,
                            estatisticas: {}
                        }
                    });

                    jogadoresProcessados.add(jogadorId);

                } catch (error) {
                    console.error(`Erro ao processar transferência:`, error);
                }
            }

            let jogadoresRegularesProcessados = 0;

            for (const jt of jogadoresTimesAnoAnterior) {
                try {
                    const jogadorId = jt.jogadorId;

                    if (jogadoresProcessados.has(jogadorId)) {
                        continue;
                    }

                    const timeOriginalId = jt.timeId;
                    const novoTimeId = mapeamentoIds.get(timeOriginalId);

                    if (!novoTimeId) {
                        console.error(`Não foi encontrado novo ID para o time original ${timeOriginalId}`);
                        continue;
                    }

                    await tx.jogadorTime.create({
                        data: {
                            jogadorId: jogadorId,
                            timeId: novoTimeId,
                            temporada: ano,
                            numero: jt.numero,
                            camisa: jt.camisa,
                            estatisticas: {}
                        }
                    });

                    jogadoresRegularesProcessados++;

                    jogadoresProcessados.add(jogadorId);

                } catch (error) {
                    console.error(`Erro ao processar jogador regular:`, error);
                }
            }


            const saveTransferenciasToJson = async (
                transferencias: Transferencia[],
                anoOrigem: string,
                anoDestino: string
            ): Promise<number> => {
                try {
                    const dirPath = path.join(process.cwd(), 'public', 'data');

                    if (!fs.existsSync(dirPath)) {
                        console.log(`Criando diretório: ${dirPath}`);
                        fs.mkdirSync(dirPath, { recursive: true });
                    }

                    const transferenciasFormatadas = [];

                    for (const transferencia of transferencias) {
                        const jogador = await prisma.jogador.findUnique({
                            where: { id: transferencia.jogadorId }
                        });

                        const timeOrigem = transferencia.timeOrigemId ?
                            await prisma.time.findUnique({ where: { id: transferencia.timeOrigemId } }) :
                            null;

                        const timeDestino = await prisma.time.findUnique({
                            where: { id: transferencia.novoTimeId }
                        });

                        transferenciasFormatadas.push({
                            id: transferencia.jogadorId,
                            jogadorNome: jogador?.nome || transferencia.jogadorNome,
                            timeOrigemId: transferencia.timeOrigemId,
                            timeOrigemNome: timeOrigem?.nome || '',
                            timeOrigemSigla: timeOrigem?.sigla || '',
                            timeDestinoId: transferencia.novoTimeId,
                            timeDestinoNome: timeDestino?.nome || transferencia.novoTimeNome,
                            timeDestinoSigla: timeDestino?.sigla || '',
                            novaPosicao: transferencia.novaPosicao || null,
                            novoSetor: transferencia.novoSetor || null,
                            novoNumero: transferencia.novoNumero || null,
                            novaCamisa: transferencia.novaCamisa || null,
                            data: new Date().toISOString()
                        });
                    }

                    const filePath = path.join(dirPath, `transferencias_${anoOrigem}_${anoDestino}.json`);
                    console.log(`Salvando transferências em: ${filePath}`);

                    fs.writeFileSync(filePath, JSON.stringify(transferenciasFormatadas, null, 2));
                    console.log(`${transferenciasFormatadas.length} transferências salvas com sucesso em ${filePath}`);
                    return transferenciasFormatadas.length;
                } catch (error) {
                    console.error('Erro ao salvar transferências em JSON:', error);
                    return 0;
                }
            };

            const totalSalvo = await saveTransferenciasToJson(transferencias, anoAnterior, ano);
            console.log(`Total de ${totalSalvo} transferências salvas em JSON`);
            const jogadoresNovaTemporada = await tx.jogadorTime.count({
                where: { temporada: ano }
            });

            console.log(`Contagem final: ${jogadoresNovaTemporada} jogadores na temporada ${ano}`);

            return {
                message: `Temporada ${ano} iniciada com sucesso!`,
                times: 0, // Substitua pelo número real
                jogadores: 0, // Substitua pelo número real
                transferencias: totalSalvo
            };

        } catch (error) {
            console.error(`Erro ao iniciar temporada:`, error);
            throw error;
        }
    }, {
        timeout: 120000,
    });

    res.status(200).json(result);
});

// ROTA 1: COMPARAR TIMES (Principal solicitada)
mainRouter.get('/comparar-times', async function (req: Request, res: Response) {
    try {
        const time1Id = req.query.time1Id as string;
        const time2Id = req.query.time2Id as string;
        const temporada = (req.query.temporada as string) || '2024';

        // Validar parâmetros
        if (!time1Id || !time2Id) {
            res.status(400).json({ error: 'É necessário fornecer IDs de dois times diferentes' });
            return;
        }

        if (time1Id === time2Id) {
            res.status(400).json({ error: 'Os times precisam ser diferentes para comparação' });
            return;
        }

        // Buscar dados dos times
        const [time1, time2] = await Promise.all([
            prisma.time.findUnique({
                where: { id: Number(time1Id) },
                include: {
                    jogadores: {
                        where: { temporada: temporada },
                        include: { jogador: true }
                    }
                }
            }),
            prisma.time.findUnique({
                where: { id: Number(time2Id) },
                include: {
                    jogadores: {
                        where: { temporada: temporada },
                        include: { jogador: true }
                    }
                }
            })
        ]);

        if (!time1 || !time2) {
            res.status(404).json({ error: 'Um ou ambos os times não foram encontrados' });
            return;
        }

        // Processar dados dos times para comparação
        const time1Estatisticas = calcularEstatisticasTimeFA(time1);
        const time2Estatisticas = calcularEstatisticasTimeFA(time2);

        // Identificar jogadores destaque
        const time1Destaques = identificarJogadoresDestaqueFA(time1);
        const time2Destaques = identificarJogadoresDestaqueFA(time2);

        // Construir objeto de resposta
        const result = {
            teams: {
                time1: {
                    id: time1.id,
                    nome: time1.nome,
                    sigla: time1.sigla,
                    cor: time1.cor,
                    logo: time1.logo,
                    cidade: time1.cidade,
                    estadio: time1.estadio,
                    head_coach: time1.head_coach,
                    fundacao: time1.fundacao,
                    titulos: time1.titulos,
                    estatisticas: time1Estatisticas,
                    destaques: time1Destaques
                },
                time2: {
                    id: time2.id,
                    nome: time2.nome,
                    sigla: time2.sigla,
                    cor: time2.cor,
                    logo: time2.logo,
                    cidade: time2.cidade,
                    estadio: time2.estadio,
                    head_coach: time2.head_coach,
                    fundacao: time2.fundacao,
                    titulos: time2.titulos,
                    estatisticas: time2Estatisticas,
                    destaques: time2Destaques
                }
            }
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('Erro ao comparar times:', error);
        res.status(500).json({ error: 'Erro ao processar comparação de times' });
    }
});

// ROTA 2: IMPORTAR TIMES VIA EXCEL
mainRouter.post('/importar-times', upload.single('arquivo'), async (req, res) => {
    console.log('Rota /importar-times chamada')
    try {
        if (!req.file) {
            console.log('Nenhum arquivo enviado');
            res.status(400).json({ error: 'Nenhum arquivo enviado' });
            return;
        }

        console.log('Arquivo recebido:', req.file.path);

        // Carrega o arquivo Excel
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const timeSheet = workbook.Sheets[sheetName];

        // Converte para JSON
        let timesRaw = xlsx.utils.sheet_to_json(timeSheet) as any[];

        // Pré-processamento para garantir tipos corretos
        const times = timesRaw.map(time => ({
            ...time,
            temporada: time.temporada ? String(time.temporada) : '2024'
        }));

        // Array para armazenar resultados
        const resultados = {
            sucesso: 0,
            erros: [] as any[]
        };

        // Processa cada time
        for (const time of times) {
            try {
                console.log(`Processando time: ${time.nome}, temporada: ${time.temporada}`);

                // Validação básica
                if (!time.nome || !time.sigla || !time.cor) {
                    resultados.erros.push({
                        time: time.nome || 'Desconhecido',
                        erro: 'Dados obrigatórios ausentes'
                    });
                    continue;
                }

                // Verifica se o time já existe
                const timeExistente = await prisma.time.findFirst({
                    where: {
                        nome: time.nome,
                        temporada: String(time.temporada)
                    }
                });

                if (timeExistente) {
                    // Atualiza o time existente
                    await prisma.time.update({
                        where: { id: timeExistente.id },
                        data: {
                            sigla: time.sigla,
                            cor: time.cor,
                            cidade: time.cidade || '',
                            bandeira_estado: time.bandeira_estado || '',
                            fundacao: time.fundacao || '',
                            logo: time.logo || '',
                            capacete: time.capacete || '',
                            instagram: time.instagram || '',
                            instagram2: time.instagram2 || '',
                            estadio: time.estadio || '',
                            presidente: time.presidente || '',
                            head_coach: time.head_coach || '',
                            instagram_coach: time.instagram_coach || '',
                            coord_ofen: time.coord_ofen || '',
                            coord_defen: time.coord_defen || '',
                            titulos: time.titulos || []
                        }
                    });
                } else {
                    // Cria um novo time
                    await prisma.time.create({
                        data: {
                            nome: time.nome,
                            sigla: time.sigla,
                            cor: time.cor,
                            cidade: time.cidade || '',
                            bandeira_estado: time.bandeira_estado || '',
                            fundacao: time.fundacao || '',
                            logo: time.logo || '',
                            capacete: time.capacete || '',
                            instagram: time.instagram || '',
                            instagram2: time.instagram2 || '',
                            estadio: time.estadio || '',
                            presidente: time.presidente || '',
                            head_coach: time.head_coach || '',
                            instagram_coach: time.instagram_coach || '',
                            coord_ofen: time.coord_ofen || '',
                            coord_defen: time.coord_defen || '',
                            titulos: time.titulos || [],
                            temporada: String(time.temporada)
                        }
                    });
                }

                resultados.sucesso++;
            } catch (error) {
                console.error(`Erro ao processar time ${time.nome}:`, error);
                resultados.erros.push({
                    time: time.nome || 'Desconhecido',
                    erro: error instanceof Error ? error.message : 'Erro desconhecido'
                });
            }
        }

        // Remove o arquivo após processamento
        fs.unlinkSync(req.file.path);

        res.status(200).json({
            mensagem: `Processamento concluído: ${resultados.sucesso} times importados com sucesso`,
            erros: resultados.erros.length > 0 ? resultados.erros : null
        });
    } catch (error) {
        console.error('Erro ao processar planilha de times:', error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Erro ao processar a planilha de times',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// ROTA 3: IMPORTAR JOGADORES VIA EXCEL
mainRouter.post('/importar-jogadores', upload.single('arquivo'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Nenhum arquivo enviado' });
            return;
        }

        console.log('Arquivo recebido:', req.file.path);

        // Carrega o arquivo Excel
        const workbook = xlsx.readFile(req.file.path, {
            raw: false,
            cellText: true
        });

        const sheetName = workbook.SheetNames[0];
        const jogadorSheet = workbook.Sheets[sheetName];

        // Converte para JSON
        let jogadoresRaw = xlsx.utils.sheet_to_json(jogadorSheet) as any[];

        // Função para converter números para strings
        function convertNumbersToStrings(obj: any): any {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj === 'number') return String(obj);
            if (Array.isArray(obj)) return obj.map(item => convertNumbersToStrings(item));
            if (typeof obj === 'object') {
                const result: any = {};
                for (const key in obj) {
                    result[key] = convertNumbersToStrings(obj[key]);
                }
                return result;
            }
            return obj;
        }

        jogadoresRaw = convertNumbersToStrings(jogadoresRaw);

        const resultados = {
            sucesso: 0,
            erros: [] as any[]
        };

        // Processa cada jogador
        for (const jogador of jogadoresRaw) {
            try {
                // Validação básica
                if (!jogador.nome || !jogador.time_nome) {
                    resultados.erros.push({
                        jogador: jogador.nome || 'Desconhecido',
                        erro: 'Dados obrigatórios ausentes'
                    });
                    continue;
                }

                // Busca o time relacionado
                const time = await prisma.time.findFirst({
                    where: {
                        nome: jogador.time_nome,
                        temporada: jogador.temporada || '2024'
                    }
                });

                if (!time) {
                    resultados.erros.push({
                        jogador: jogador.nome,
                        erro: `Time "${jogador.time_nome}" não encontrado`
                    });
                    continue;
                }

                // Prepara as estatísticas com estrutura completa do futebol americano
                const estatisticas = {
                    passe: {
                        passes_completos: Number(jogador.passes_completos || 0),
                        passes_tentados: Number(jogador.passes_tentados || 0),
                        jardas_de_passe: Number(jogador.jardas_de_passe || 0),
                        td_passados: Number(jogador.td_passados || 0),
                        interceptacoes_sofridas: Number(jogador.interceptacoes_sofridas || 0),
                        sacks_sofridos: Number(jogador.sacks_sofridos || 0),
                        fumble_de_passador: Number(jogador.fumble_de_passador || 0)
                    },
                    corrida: {
                        corridas: Number(jogador.corridas || 0),
                        jardas_corridas: Number(jogador.jardas_corridas || 0),
                        tds_corridos: Number(jogador.tds_corridos || 0),
                        fumble_de_corredor: Number(jogador.fumble_de_corredor || 0)
                    },
                    recepcao: {
                        recepcoes: Number(jogador.recepcoes || 0),
                        alvo: Number(jogador.alvo || 0),
                        jardas_recebidas: Number(jogador.jardas_recebidas || 0),
                        tds_recebidos: Number(jogador.tds_recebidos || 0)
                    },
                    retorno: {
                        retornos: Number(jogador.retornos || 0),
                        jardas_retornadas: Number(jogador.jardas_retornadas || 0),
                        td_retornados: Number(jogador.td_retornados || 0)
                    },
                    defesa: {
                        tackles_totais: Number(jogador.tackles_totais || 0),
                        tackles_for_loss: Number(jogador.tackles_for_loss || 0),
                        sacks_forcado: Number(jogador.sacks_forcado || 0),
                        fumble_forcado: Number(jogador.fumble_forcado || 0),
                        interceptacao_forcada: Number(jogador.interceptacao_forcada || 0),
                        passe_desviado: Number(jogador.passe_desviado || 0),
                        safety: Number(jogador.safety || 0),
                        td_defensivo: Number(jogador.td_defensivo || 0)
                    },
                    kicker: {
                        xp_bons: Number(jogador.xp_bons || 0),
                        tentativas_de_xp: Number(jogador.tentativas_de_xp || 0),
                        fg_bons: Number(jogador.fg_bons || 0),
                        tentativas_de_fg: Number(jogador.tentativas_de_fg || 0),
                        fg_mais_longo: Number(jogador.fg_mais_longo || 0)
                    },
                    punter: {
                        punts: Number(jogador.punts || 0),
                        jardas_de_punt: Number(jogador.jardas_de_punt || 0)
                    }
                };

                // Verifica se o jogador já existe
                let jogadorExistente = await prisma.jogador.findFirst({
                    where: {
                        nome: jogador.nome,
                        times: {
                            some: {
                                timeId: time.id,
                                temporada: jogador.temporada || '2024'
                            }
                        }
                    },
                    include: {
                        times: {
                            where: {
                                timeId: time.id,
                                temporada: jogador.temporada || '2024'
                            }
                        }
                    }
                });

                if (jogadorExistente) {
                    // Atualiza o vínculo se existir
                    if (jogadorExistente.times && jogadorExistente.times.length > 0) {
                        await prisma.jogadorTime.update({
                            where: { id: jogadorExistente.times[0].id },
                            data: {
                                numero: Number(jogador.numero || 0),
                                camisa: jogador.camisa || '',
                                estatisticas: estatisticas
                            }
                        });
                    }
                } else {
                    // Cria um novo jogador
                    const novoJogador = await prisma.jogador.create({
                        data: {
                            nome: jogador.nome,
                            posicao: jogador.posicao || '',
                            setor: jogador.setor || 'Ataque',
                            experiencia: Number(jogador.experiencia || 0),
                            idade: Number(jogador.idade || 0),
                            altura: Number(jogador.altura || 0),
                            peso: Number(jogador.peso || 0),
                            instagram: jogador.instagram || '',
                            instagram2: jogador.instagram2 || '',
                            cidade: jogador.cidade || '',
                            nacionalidade: jogador.nacionalidade || '',
                            timeFormador: jogador.timeFormador || ''
                        }
                    });

                    // Cria o vínculo com o time
                    await prisma.jogadorTime.create({
                        data: {
                            jogadorId: novoJogador.id,
                            timeId: time.id,
                            temporada: jogador.temporada || '2024',
                            numero: Number(jogador.numero || 0),
                            camisa: jogador.camisa || '',
                            estatisticas: estatisticas
                        }
                    });
                }

                resultados.sucesso++;
            } catch (error) {
                console.error(`Erro ao processar jogador ${jogador.nome}:`, error);
                resultados.erros.push({
                    jogador: jogador.nome || 'Desconhecido',
                    erro: error instanceof Error ? error.message : 'Erro desconhecido'
                });
            }
        }

        // Remove o arquivo após processamento
        fs.unlinkSync(req.file.path);

        res.status(200).json({
            mensagem: `Processamento concluído: ${resultados.sucesso} jogadores importados com sucesso`,
            erros: resultados.erros.length > 0 ? resultados.erros : null
        });
    } catch (error) {
        console.error('Erro ao processar planilha de jogadores:', error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Erro ao processar a planilha de jogadores',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// ROTA 4: ATUALIZAR ESTATÍSTICAS DE JOGO
mainRouter.post('/atualizar-estatisticas', upload.single('arquivo'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Nenhum arquivo enviado' });
            return;
        }

        const { id_jogo, data_jogo } = req.body;

        if (!id_jogo || !data_jogo) {
            res.status(400).json({ error: 'ID do jogo e data são obrigatórios' });
            return;
        }

        // Verifica se já existe a tabela MetaDados (caso não exista, pode ser criada via migration)
        // Por enquanto, vamos verificar se o jogo já foi processado de forma simples

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const statsSheet = workbook.Sheets[sheetName];

        const estatisticasJogo = xlsx.utils.sheet_to_json(statsSheet) as any[];

        const resultados = {
            sucesso: 0,
            erros: [] as any[]
        };

        // Processa cada linha de estatísticas
        for (const stat of estatisticasJogo) {
            try {
                if (!stat.jogador_id && !stat.jogador_nome) {
                    resultados.erros.push({
                        linha: JSON.stringify(stat),
                        erro: 'ID ou nome do jogador é obrigatório'
                    });
                    continue;
                }

                const temporada = String(stat.temporada || '2024');

                // Busca o jogador
                let jogador;
                let jogadorTime;

                if (stat.jogador_id) {
                    const jogadorId = Number(stat.jogador_id);

                    jogador = await prisma.jogador.findUnique({
                        where: { id: jogadorId }
                    });

                    if (!jogador) {
                        throw new Error(`Jogador ID ${jogadorId} não encontrado`);
                    }

                    const jogadorTimes = await prisma.jogadorTime.findMany({
                        where: {
                            jogadorId: jogadorId,
                            temporada: temporada
                        }
                    });

                    if (!jogadorTimes || jogadorTimes.length === 0) {
                        throw new Error(`Jogador ID ${jogadorId} não tem relação com time na temporada ${temporada}`);
                    }

                    jogadorTime = jogadorTimes[0];
                }

                if (!jogador || !jogadorTime) {
                    resultados.erros.push({
                        jogador: stat.jogador_nome || stat.jogador_id,
                        erro: 'Jogador não encontrado ou não relacionado a nenhum time'
                    });
                    continue;
                }

                // Obtém as estatísticas atuais
                const estatisticasAtuais = jogadorTime.estatisticas as any || {};

                // Cria estatísticas do jogo
                const estatisticasDoJogo = {
                    passe: {
                        passes_completos: Number(stat.passes_completos || 0),
                        passes_tentados: Number(stat.passes_tentados || 0),
                        jardas_de_passe: Number(stat.jardas_de_passe || 0),
                        td_passados: Number(stat.td_passados || 0),
                        interceptacoes_sofridas: Number(stat.interceptacoes_sofridas || 0),
                        sacks_sofridos: Number(stat.sacks_sofridos || 0),
                        fumble_de_passador: Number(stat.fumble_de_passador || 0)
                    },
                    corrida: {
                        corridas: Number(stat.corridas || 0),
                        jardas_corridas: Number(stat.jardas_corridas || 0),
                        tds_corridos: Number(stat.tds_corridos || 0),
                        fumble_de_corredor: Number(stat.fumble_de_corredor || 0)
                    },
                    recepcao: {
                        recepcoes: Number(stat.recepcoes || 0),
                        alvo: Number(stat.alvo || 0),
                        jardas_recebidas: Number(stat.jardas_recebidas || 0),
                        tds_recebidos: Number(stat.tds_recebidos || 0)
                    },
                    retorno: {
                        retornos: Number(stat.retornos || 0),
                        jardas_retornadas: Number(stat.jardas_retornadas || 0),
                        td_retornados: Number(stat.td_retornados || 0)
                    },
                    defesa: {
                        tackles_totais: Number(stat.tackles_totais || 0),
                        tackles_for_loss: Number(stat.tackles_for_loss || 0),
                        sacks_forcado: Number(stat.sacks_forcado || 0),
                        fumble_forcado: Number(stat.fumble_forcado || 0),
                        interceptacao_forcada: Number(stat.interceptacao_forcada || 0),
                        passe_desviado: Number(stat.passe_desviado || 0),
                        safety: Number(stat.safety || 0),
                        td_defensivo: Number(stat.td_defensivo || 0)
                    },
                    kicker: {
                        xp_bons: Number(stat.xp_bons || 0),
                        tentativas_de_xp: Number(stat.tentativas_de_xp || 0),
                        fg_bons: Number(stat.fg_bons || 0),
                        tentativas_de_fg: Number(stat.tentativas_de_fg || 0),
                        fg_mais_longo: Number(stat.fg_mais_longo || 0)
                    },
                    punter: {
                        punts: Number(stat.punts || 0),
                        jardas_de_punt: Number(stat.jardas_de_punt || 0)
                    }
                };

                // Combina as estatísticas (soma com as existentes)
                const novasEstatisticas = {
                    passe: {
                        passes_completos: (estatisticasAtuais.passe?.passes_completos || 0) + estatisticasDoJogo.passe.passes_completos,
                        passes_tentados: (estatisticasAtuais.passe?.passes_tentados || 0) + estatisticasDoJogo.passe.passes_tentados,
                        jardas_de_passe: (estatisticasAtuais.passe?.jardas_de_passe || 0) + estatisticasDoJogo.passe.jardas_de_passe,
                        td_passados: (estatisticasAtuais.passe?.td_passados || 0) + estatisticasDoJogo.passe.td_passados,
                        interceptacoes_sofridas: (estatisticasAtuais.passe?.interceptacoes_sofridas || 0) + estatisticasDoJogo.passe.interceptacoes_sofridas,
                        sacks_sofridos: (estatisticasAtuais.passe?.sacks_sofridos || 0) + estatisticasDoJogo.passe.sacks_sofridos,
                        fumble_de_passador: (estatisticasAtuais.passe?.fumble_de_passador || 0) + estatisticasDoJogo.passe.fumble_de_passador
                    },
                    corrida: {
                        corridas: (estatisticasAtuais.corrida?.corridas || 0) + estatisticasDoJogo.corrida.corridas,
                        jardas_corridas: (estatisticasAtuais.corrida?.jardas_corridas || 0) + estatisticasDoJogo.corrida.jardas_corridas,
                        tds_corridos: (estatisticasAtuais.corrida?.tds_corridos || 0) + estatisticasDoJogo.corrida.tds_corridos,
                        fumble_de_corredor: (estatisticasAtuais.corrida?.fumble_de_corredor || 0) + estatisticasDoJogo.corrida.fumble_de_corredor
                    },
                    recepcao: {
                        recepcoes: (estatisticasAtuais.recepcao?.recepcoes || 0) + estatisticasDoJogo.recepcao.recepcoes,
                        alvo: (estatisticasAtuais.recepcao?.alvo || 0) + estatisticasDoJogo.recepcao.alvo,
                        jardas_recebidas: (estatisticasAtuais.recepcao?.jardas_recebidas || 0) + estatisticasDoJogo.recepcao.jardas_recebidas,
                        tds_recebidos: (estatisticasAtuais.recepcao?.tds_recebidos || 0) + estatisticasDoJogo.recepcao.tds_recebidos
                    },
                    retorno: {
                        retornos: (estatisticasAtuais.retorno?.retornos || 0) + estatisticasDoJogo.retorno.retornos,
                        jardas_retornadas: (estatisticasAtuais.retorno?.jardas_retornadas || 0) + estatisticasDoJogo.retorno.jardas_retornadas,
                        td_retornados: (estatisticasAtuais.retorno?.td_retornados || 0) + estatisticasDoJogo.retorno.td_retornados
                    },
                    defesa: {
                        tackles_totais: (estatisticasAtuais.defesa?.tackles_totais || 0) + estatisticasDoJogo.defesa.tackles_totais,
                        tackles_for_loss: (estatisticasAtuais.defesa?.tackles_for_loss || 0) + estatisticasDoJogo.defesa.tackles_for_loss,
                        sacks_forcado: (estatisticasAtuais.defesa?.sacks_forcado || 0) + estatisticasDoJogo.defesa.sacks_forcado,
                        fumble_forcado: (estatisticasAtuais.defesa?.fumble_forcado || 0) + estatisticasDoJogo.defesa.fumble_forcado,
                        interceptacao_forcada: (estatisticasAtuais.defesa?.interceptacao_forcada || 0) + estatisticasDoJogo.defesa.interceptacao_forcada,
                        passe_desviado: (estatisticasAtuais.defesa?.passe_desviado || 0) + estatisticasDoJogo.defesa.passe_desviado,
                        safety: (estatisticasAtuais.defesa?.safety || 0) + estatisticasDoJogo.defesa.safety,
                        td_defensivo: (estatisticasAtuais.defesa?.td_defensivo || 0) + estatisticasDoJogo.defesa.td_defensivo
                    },
                    kicker: {
                        xp_bons: (estatisticasAtuais.kicker?.xp_bons || 0) + estatisticasDoJogo.kicker.xp_bons,
                        tentativas_de_xp: (estatisticasAtuais.kicker?.tentativas_de_xp || 0) + estatisticasDoJogo.kicker.tentativas_de_xp,
                        fg_bons: (estatisticasAtuais.kicker?.fg_bons || 0) + estatisticasDoJogo.kicker.fg_bons,
                        tentativas_de_fg: (estatisticasAtuais.kicker?.tentativas_de_fg || 0) + estatisticasDoJogo.kicker.tentativas_de_fg,
                        fg_mais_longo: Math.max(estatisticasAtuais.kicker?.fg_mais_longo || 0, estatisticasDoJogo.kicker.fg_mais_longo)
                    },
                    punter: {
                        punts: (estatisticasAtuais.punter?.punts || 0) + estatisticasDoJogo.punter.punts,
                        jardas_de_punt: (estatisticasAtuais.punter?.jardas_de_punt || 0) + estatisticasDoJogo.punter.jardas_de_punt
                    }
                };

                // Atualiza as estatísticas do jogador
                await prisma.jogadorTime.update({
                    where: { id: jogadorTime.id },
                    data: {
                        estatisticas: novasEstatisticas
                    }
                });

                resultados.sucesso++;
            } catch (error) {
                console.error(`Erro ao processar estatísticas para jogador:`, error);
                resultados.erros.push({
                    jogador: stat.jogador_nome || stat.jogador_id || 'Desconhecido',
                    erro: error instanceof Error ? error.message : 'Erro desconhecido'
                });
            }
        }

        // Remove o arquivo após processamento
        fs.unlinkSync(req.file.path);

        res.status(200).json({
            mensagem: `Estatísticas do jogo ${id_jogo} processadas com sucesso para ${resultados.sucesso} jogadores`,
            data_jogo,
            erros: resultados.erros.length > 0 ? resultados.erros : null
        });
    } catch (error) {
        console.error('Erro ao processar estatísticas do jogo:', error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Erro ao processar estatísticas do jogo',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// FUNÇÕES AUXILIARES PARA FUTEBOL AMERICANO

// Função para calcular estatísticas agregadas de um time (Futebol Americano)
function calcularEstatisticasTimeFA(time: any) {
    const jogadores = time.jogadores.map((jt: any) => ({
        ...jt.jogador,
        estatisticas: jt.estatisticas,
        numero: jt.numero,
        camisa: jt.camisa
    }));

    // Inicializa todas as categorias de estatísticas do futebol americano
    const passe = {
        passes_completos: 0,
        passes_tentados: 0,
        jardas_de_passe: 0,
        td_passados: 0,
        interceptacoes_sofridas: 0,
        sacks_sofridos: 0,
        fumble_de_passador: 0
    };

    const corrida = {
        corridas: 0,
        jardas_corridas: 0,
        tds_corridos: 0,
        fumble_de_corredor: 0
    };

    const recepcao = {
        recepcoes: 0,
        alvo: 0,
        jardas_recebidas: 0,
        tds_recebidos: 0
    };

    const retorno = {
        retornos: 0,
        jardas_retornadas: 0,
        td_retornados: 0
    };

    const defesa = {
        tackles_totais: 0,
        tackles_for_loss: 0,
        sacks_forcado: 0,
        fumble_forcado: 0,
        interceptacao_forcada: 0,
        passe_desviado: 0,
        safety: 0,
        td_defensivo: 0
    };

    const kicker = {
        xp_bons: 0,
        tentativas_de_xp: 0,
        fg_bons: 0,
        tentativas_de_fg: 0,
        fg_mais_longo: 0
    };

    const punter = {
        punts: 0,
        jardas_de_punt: 0
    };

    // Calcular totais
    jogadores.forEach((jogador: any) => {
        if (jogador.estatisticas?.passe) {
            const e = jogador.estatisticas.passe;
            passe.passes_completos += e.passes_completos || 0;
            passe.passes_tentados += e.passes_tentados || 0;
            passe.jardas_de_passe += e.jardas_de_passe || 0;
            passe.td_passados += e.td_passados || 0;
            passe.interceptacoes_sofridas += e.interceptacoes_sofridas || 0;
            passe.sacks_sofridos += e.sacks_sofridos || 0;
            passe.fumble_de_passador += e.fumble_de_passador || 0;
        }

        if (jogador.estatisticas?.corrida) {
            const e = jogador.estatisticas.corrida;
            corrida.corridas += e.corridas || 0;
            corrida.jardas_corridas += e.jardas_corridas || 0;
            corrida.tds_corridos += e.tds_corridos || 0;
            corrida.fumble_de_corredor += e.fumble_de_corredor || 0;
        }

        if (jogador.estatisticas?.recepcao) {
            const e = jogador.estatisticas.recepcao;
            recepcao.recepcoes += e.recepcoes || 0;
            recepcao.alvo += e.alvo || 0;
            recepcao.jardas_recebidas += e.jardas_recebidas || 0;
            recepcao.tds_recebidos += e.tds_recebidos || 0;
        }

        if (jogador.estatisticas?.retorno) {
            const e = jogador.estatisticas.retorno;
            retorno.retornos += e.retornos || 0;
            retorno.jardas_retornadas += e.jardas_retornadas || 0;
            retorno.td_retornados += e.td_retornados || 0;
        }

        if (jogador.estatisticas?.defesa) {
            const e = jogador.estatisticas.defesa;
            defesa.tackles_totais += e.tackles_totais || 0;
            defesa.tackles_for_loss += e.tackles_for_loss || 0;
            defesa.sacks_forcado += e.sacks_forcado || 0;
            defesa.fumble_forcado += e.fumble_forcado || 0;
            defesa.interceptacao_forcada += e.interceptacao_forcada || 0;
            defesa.passe_desviado += e.passe_desviado || 0;
            defesa.safety += e.safety || 0;
            defesa.td_defensivo += e.td_defensivo || 0;
        }

        if (jogador.estatisticas?.kicker) {
            const e = jogador.estatisticas.kicker;
            kicker.xp_bons += e.xp_bons || 0;
            kicker.tentativas_de_xp += e.tentativas_de_xp || 0;
            kicker.fg_bons += e.fg_bons || 0;
            kicker.tentativas_de_fg += e.tentativas_de_fg || 0;
            kicker.fg_mais_longo = Math.max(kicker.fg_mais_longo, e.fg_mais_longo || 0);
        }

        if (jogador.estatisticas?.punter) {
            const e = jogador.estatisticas.punter;
            punter.punts += e.punts || 0;
            punter.jardas_de_punt += e.jardas_de_punt || 0;
        }
    });

    return { passe, corrida, recepcao, retorno, defesa, kicker, punter };
}

// Função para identificar jogadores destaque (Futebol Americano)
function identificarJogadoresDestaqueFA(time: any) {
    const jogadores = time.jogadores.map((jt: any) => ({
        id: jt.jogador.id,
        nome: jt.jogador.nome,
        posicao: jt.jogador.posicao,
        setor: jt.jogador.setor,
        camisa: jt.camisa,
        numero: jt.numero,
        estatisticas: jt.estatisticas
    }));

    const destaques = {
        ataque: {
            passador: null,
            corredor: null,
            recebedor: null
        },
        defesa: {
            tackler: null,
            passRush: null,
            interceptador: null
        },
        especialistas: {
            kicker: null,
            punter: null,
            retornador: null
        }
    };

    // Melhor passador (TD passes)
    destaques.ataque.passador = jogadores
        .filter((j: any) => j.estatisticas?.passe?.td_passados > 0)
        .sort((a: any, b: any) => (b.estatisticas?.passe?.td_passados || 0) - (a.estatisticas?.passe?.td_passados || 0))[0] || null;

    // Melhor corredor (jardas corridas)
    destaques.ataque.corredor = jogadores
        .filter((j: any) => j.estatisticas?.corrida?.jardas_corridas > 0)
        .sort((a: any, b: any) => (b.estatisticas?.corrida?.jardas_corridas || 0) - (a.estatisticas?.corrida?.jardas_corridas || 0))[0] || null;

    // Melhor recebedor (jardas recebidas)
    destaques.ataque.recebedor = jogadores
        .filter((j: any) => j.estatisticas?.recepcao?.jardas_recebidas > 0)
        .sort((a: any, b: any) => (b.estatisticas?.recepcao?.jardas_recebidas || 0) - (a.estatisticas?.recepcao?.jardas_recebidas || 0))[0] || null;

    // Melhor tackler
    destaques.defesa.tackler = jogadores
        .filter((j: any) => j.estatisticas?.defesa?.tackles_totais > 0)
        .sort((a: any, b: any) => (b.estatisticas?.defesa?.tackles_totais || 0) - (a.estatisticas?.defesa?.tackles_totais || 0))[0] || null;

    // Melhor pass rush (sacks)
    destaques.defesa.passRush = jogadores
        .filter((j: any) => j.estatisticas?.defesa?.sacks_forcado > 0)
        .sort((a: any, b: any) => (b.estatisticas?.defesa?.sacks_forcado || 0) - (a.estatisticas?.defesa?.sacks_forcado || 0))[0] || null;

    // Melhor interceptador
    destaques.defesa.interceptador = jogadores
        .filter((j: any) => j.estatisticas?.defesa?.interceptacao_forcada > 0)
        .sort((a: any, b: any) => (b.estatisticas?.defesa?.interceptacao_forcada || 0) - (a.estatisticas?.defesa?.interceptacao_forcada || 0))[0] || null;

    // Melhor kicker (eficiência em field goals)
    destaques.especialistas.kicker = jogadores
        .filter((j: any) => j.estatisticas?.kicker?.tentativas_de_fg > 0)
        .sort((a: any, b: any) => {
            const eficA = (a.estatisticas?.kicker?.fg_bons || 0) / (a.estatisticas?.kicker?.tentativas_de_fg || 1);
            const eficB = (b.estatisticas?.kicker?.fg_bons || 0) / (b.estatisticas?.kicker?.tentativas_de_fg || 1);
            return eficB - eficA;
        })[0] || null;

    // Melhor punter (média de jardas)
    destaques.especialistas.punter = jogadores
        .filter((j: any) => j.estatisticas?.punter?.punts > 0)
        .sort((a: any, b: any) => {
            const mediaA = (a.estatisticas?.punter?.jardas_de_punt || 0) / (a.estatisticas?.punter?.punts || 1);
            const mediaB = (b.estatisticas?.punter?.jardas_de_punt || 0) / (b.estatisticas?.punter?.punts || 1);
            return mediaB - mediaA;
        })[0] || null;

    // Melhor retornador (jardas retornadas)
    destaques.especialistas.retornador = jogadores
        .filter((j: any) => j.estatisticas?.retorno?.jardas_retornadas > 0)
        .sort((a: any, b: any) => (b.estatisticas?.retorno?.jardas_retornadas || 0) - (a.estatisticas?.retorno?.jardas_retornadas || 0))[0] || null;

    return destaques;
}

// ROTA 5: REPROCESSAR JOGO
mainRouter.post('/reprocessar-jogo', upload.single('arquivo'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Nenhum arquivo enviado' });
            return;
        }

        const { id_jogo, data_jogo, force } = req.body;

        if (!id_jogo || !data_jogo) {
            res.status(400).json({ error: 'ID do jogo e data são obrigatórios' });
            return;
        }

        // Verificar se o jogo já foi processado anteriormente
        const jogosJaProcessados = await prisma.metaDados.findFirst({
            where: { chave: 'jogos_processados' }
        });

        let jogosProcessados: Record<string, any> = {};
        if (jogosJaProcessados && jogosJaProcessados.valor) {
            try {
                jogosProcessados = JSON.parse(jogosJaProcessados.valor);
            } catch (e) {
                console.warn('Erro ao parsear jogos processados:', e);
                jogosProcessados = {};
            }
        }

        // Se o jogo não foi processado antes, use a rota normal
        if (!jogosProcessados[id_jogo] && !force) {
            res.status(400).json({
                error: `O jogo ${id_jogo} não foi processado anteriormente.`,
                message: 'Use a rota /atualizar-estatisticas para processá-lo pela primeira vez.'
            });
            return;
        }

        // Carrega o arquivo Excel
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const statsSheet = workbook.Sheets[sheetName];

        const estatisticasJogo = xlsx.utils.sheet_to_json(statsSheet) as any[];

        console.log(`Reprocessando estatísticas de ${estatisticasJogo.length} jogadores para o jogo ${id_jogo}`);

        const resultados = {
            sucesso: 0,
            erros: [] as any[]
        };

        // Busca as estatísticas originais do jogo
        const estatisticasOriginais = await prisma.metaDados.findFirst({
            where: { chave: `estatisticas_jogo_${id_jogo}` }
        });

        let estatisticasAnteriores: Array<{
            jogadorId: number;
            timeId: number;
            temporada: string;
            estatisticas: any;
        }> = [];

        if (estatisticasOriginais && estatisticasOriginais.valor) {
            try {
                estatisticasAnteriores = JSON.parse(estatisticasOriginais.valor);
            } catch (e) {
                console.warn('Erro ao parsear estatísticas originais:', e);
                estatisticasAnteriores = [];
            }
        }

        // Inicia uma transação
        await prisma.$transaction(async (tx) => {
            // Primeiro, reverte as estatísticas anteriores
            if (estatisticasAnteriores.length > 0) {
                console.log(`Revertendo estatísticas anteriores do jogo ${id_jogo}`);

                for (const estatAnterior of estatisticasAnteriores) {
                    try {
                        const jogador = await tx.jogador.findUnique({
                            where: { id: estatAnterior.jogadorId },
                            include: {
                                times: {
                                    where: {
                                        temporada: estatAnterior.temporada,
                                        timeId: estatAnterior.timeId
                                    }
                                }
                            }
                        });

                        if (!jogador || !jogador.times || jogador.times.length === 0) {
                            console.warn(`Jogador ${estatAnterior.jogadorId} não encontrado para reverter estatísticas`);
                            continue;
                        }

                        const jogadorTime = jogador.times[0];
                        const estatisticasAtuais = jogadorTime.estatisticas as any;

                        // Subtrai as estatísticas anteriores (com Math.max para evitar valores negativos)
                        const novasEstatisticas = {
                            passe: {
                                passes_completos: Math.max(0, (estatisticasAtuais.passe?.passes_completos || 0) - (estatAnterior.estatisticas.passe?.passes_completos || 0)),
                                passes_tentados: Math.max(0, (estatisticasAtuais.passe?.passes_tentados || 0) - (estatAnterior.estatisticas.passe?.passes_tentados || 0)),
                                jardas_de_passe: Math.max(0, (estatisticasAtuais.passe?.jardas_de_passe || 0) - (estatAnterior.estatisticas.passe?.jardas_de_passe || 0)),
                                td_passados: Math.max(0, (estatisticasAtuais.passe?.td_passados || 0) - (estatAnterior.estatisticas.passe?.td_passados || 0)),
                                interceptacoes_sofridas: Math.max(0, (estatisticasAtuais.passe?.interceptacoes_sofridas || 0) - (estatAnterior.estatisticas.passe?.interceptacoes_sofridas || 0)),
                                sacks_sofridos: Math.max(0, (estatisticasAtuais.passe?.sacks_sofridos || 0) - (estatAnterior.estatisticas.passe?.sacks_sofridos || 0)),
                                fumble_de_passador: Math.max(0, (estatisticasAtuais.passe?.fumble_de_passador || 0) - (estatAnterior.estatisticas.passe?.fumble_de_passador || 0))
                            },
                            corrida: {
                                corridas: Math.max(0, (estatisticasAtuais.corrida?.corridas || 0) - (estatAnterior.estatisticas.corrida?.corridas || 0)),
                                jardas_corridas: Math.max(0, (estatisticasAtuais.corrida?.jardas_corridas || 0) - (estatAnterior.estatisticas.corrida?.jardas_corridas || 0)),
                                tds_corridos: Math.max(0, (estatisticasAtuais.corrida?.tds_corridos || 0) - (estatAnterior.estatisticas.corrida?.tds_corridos || 0)),
                                fumble_de_corredor: Math.max(0, (estatisticasAtuais.corrida?.fumble_de_corredor || 0) - (estatAnterior.estatisticas.corrida?.fumble_de_corredor || 0))
                            },
                            recepcao: {
                                recepcoes: Math.max(0, (estatisticasAtuais.recepcao?.recepcoes || 0) - (estatAnterior.estatisticas.recepcao?.recepcoes || 0)),
                                alvo: Math.max(0, (estatisticasAtuais.recepcao?.alvo || 0) - (estatAnterior.estatisticas.recepcao?.alvo || 0)),
                                jardas_recebidas: Math.max(0, (estatisticasAtuais.recepcao?.jardas_recebidas || 0) - (estatAnterior.estatisticas.recepcao?.jardas_recebidas || 0)),
                                tds_recebidos: Math.max(0, (estatisticasAtuais.recepcao?.tds_recebidos || 0) - (estatAnterior.estatisticas.recepcao?.tds_recebidos || 0))
                            },
                            retorno: {
                                retornos: Math.max(0, (estatisticasAtuais.retorno?.retornos || 0) - (estatAnterior.estatisticas.retorno?.retornos || 0)),
                                jardas_retornadas: Math.max(0, (estatisticasAtuais.retorno?.jardas_retornadas || 0) - (estatAnterior.estatisticas.retorno?.jardas_retornadas || 0)),
                                td_retornados: Math.max(0, (estatisticasAtuais.retorno?.td_retornados || 0) - (estatAnterior.estatisticas.retorno?.td_retornados || 0))
                            },
                            defesa: {
                                tackles_totais: Math.max(0, (estatisticasAtuais.defesa?.tackles_totais || 0) - (estatAnterior.estatisticas.defesa?.tackles_totais || 0)),
                                tackles_for_loss: Math.max(0, (estatisticasAtuais.defesa?.tackles_for_loss || 0) - (estatAnterior.estatisticas.defesa?.tackles_for_loss || 0)),
                                sacks_forcado: Math.max(0, (estatisticasAtuais.defesa?.sacks_forcado || 0) - (estatAnterior.estatisticas.defesa?.sacks_forcado || 0)),
                                fumble_forcado: Math.max(0, (estatisticasAtuais.defesa?.fumble_forcado || 0) - (estatAnterior.estatisticas.defesa?.fumble_forcado || 0)),
                                interceptacao_forcada: Math.max(0, (estatisticasAtuais.defesa?.interceptacao_forcada || 0) - (estatAnterior.estatisticas.defesa?.interceptacao_forcada || 0)),
                                passe_desviado: Math.max(0, (estatisticasAtuais.defesa?.passe_desviado || 0) - (estatAnterior.estatisticas.defesa?.passe_desviado || 0)),
                                safety: Math.max(0, (estatisticasAtuais.defesa?.safety || 0) - (estatAnterior.estatisticas.defesa?.safety || 0)),
                                td_defensivo: Math.max(0, (estatisticasAtuais.defesa?.td_defensivo || 0) - (estatAnterior.estatisticas.defesa?.td_defensivo || 0))
                            },
                            kicker: {
                                xp_bons: Math.max(0, (estatisticasAtuais.kicker?.xp_bons || 0) - (estatAnterior.estatisticas.kicker?.xp_bons || 0)),
                                tentativas_de_xp: Math.max(0, (estatisticasAtuais.kicker?.tentativas_de_xp || 0) - (estatAnterior.estatisticas.kicker?.tentativas_de_xp || 0)),
                                fg_bons: Math.max(0, (estatisticasAtuais.kicker?.fg_bons || 0) - (estatAnterior.estatisticas.kicker?.fg_bons || 0)),
                                tentativas_de_fg: Math.max(0, (estatisticasAtuais.kicker?.tentativas_de_fg || 0) - (estatAnterior.estatisticas.kicker?.tentativas_de_fg || 0)),
                                fg_mais_longo: estatisticasAtuais.kicker?.fg_mais_longo || 0 // Mantém o valor atual para campo mais longo
                            },
                            punter: {
                                punts: Math.max(0, (estatisticasAtuais.punter?.punts || 0) - (estatAnterior.estatisticas.punter?.punts || 0)),
                                jardas_de_punt: Math.max(0, (estatisticasAtuais.punter?.jardas_de_punt || 0) - (estatAnterior.estatisticas.punter?.jardas_de_punt || 0))
                            }
                        };

                        await tx.jogadorTime.update({
                            where: { id: jogadorTime.id },
                            data: {
                                estatisticas: novasEstatisticas
                            }
                        });

                    } catch (error) {
                        console.error(`Erro ao reverter estatísticas para jogador ${estatAnterior.jogadorId}:`, error);
                    }
                }
            }

            // Array para armazenar as novas estatísticas deste jogo
            const novasEstatisticasJogo: Array<{
                jogadorId: number;
                timeId: number;
                temporada: string;
                estatisticas: any;
            }> = [];

            // Processa cada linha de estatísticas do novo arquivo
            for (const stat of estatisticasJogo) {
                try {
                    if (!stat.jogador_id && !stat.jogador_nome) {
                        resultados.erros.push({
                            linha: JSON.stringify(stat),
                            erro: 'ID ou nome do jogador é obrigatório'
                        });
                        continue;
                    }

                    const temporada = String(stat.temporada || '2024');

                    // Busca o jogador
                    let jogador;
                    if (stat.jogador_id) {
                        jogador = await tx.jogador.findUnique({
                            where: { id: parseInt(stat.jogador_id) },
                            include: {
                                times: {
                                    where: { temporada: temporada },
                                    include: { time: true }
                                }
                            }
                        });
                    }

                    if (!jogador || !jogador.times || jogador.times.length === 0) {
                        resultados.erros.push({
                            jogador: stat.jogador_nome || stat.jogador_id,
                            erro: 'Jogador não encontrado ou não relacionado a nenhum time'
                        });
                        continue;
                    }

                    const jogadorTime = jogador.times[0];
                    const estatisticasAtuais = jogadorTime.estatisticas as any;

                    // Prepara as estatísticas para este jogo
                    const estatisticasDoJogo = {
                        passe: {
                            passes_completos: parseInt(stat.passes_completos) || 0,
                            passes_tentados: parseInt(stat.passes_tentados) || 0,
                            jardas_de_passe: parseInt(stat.jardas_de_passe) || 0,
                            td_passados: parseInt(stat.td_passados) || 0,
                            interceptacoes_sofridas: parseInt(stat.interceptacoes_sofridas) || 0,
                            sacks_sofridos: parseInt(stat.sacks_sofridos) || 0,
                            fumble_de_passador: parseInt(stat.fumble_de_passador) || 0
                        },
                        corrida: {
                            corridas: parseInt(stat.corridas) || 0,
                            jardas_corridas: parseInt(stat.jardas_corridas) || 0,
                            tds_corridos: parseInt(stat.tds_corridos) || 0,
                            fumble_de_corredor: parseInt(stat.fumble_de_corredor) || 0
                        },
                        recepcao: {
                            recepcoes: parseInt(stat.recepcoes) || 0,
                            alvo: parseInt(stat.alvo) || 0,
                            jardas_recebidas: parseInt(stat.jardas_recebidas) || 0,
                            tds_recebidos: parseInt(stat.tds_recebidos) || 0
                        },
                        retorno: {
                            retornos: parseInt(stat.retornos) || 0,
                            jardas_retornadas: parseInt(stat.jardas_retornadas) || 0,
                            td_retornados: parseInt(stat.td_retornados) || 0
                        },
                        defesa: {
                            tackles_totais: parseInt(stat.tackles_totais) || 0,
                            tackles_for_loss: parseInt(stat.tackles_for_loss) || 0,
                            sacks_forcado: parseInt(stat.sacks_forcado) || 0,
                            fumble_forcado: parseInt(stat.fumble_forcado) || 0,
                            interceptacao_forcada: parseInt(stat.interceptacao_forcada) || 0,
                            passe_desviado: parseInt(stat.passe_desviado) || 0,
                            safety: parseInt(stat.safety) || 0,
                            td_defensivo: parseInt(stat.td_defensivo) || 0
                        },
                        kicker: {
                            xp_bons: parseInt(stat.xp_bons) || 0,
                            tentativas_de_xp: parseInt(stat.tentativas_de_xp) || 0,
                            fg_bons: parseInt(stat.fg_bons) || 0,
                            tentativas_de_fg: parseInt(stat.tentativas_de_fg) || 0,
                            fg_mais_longo: parseInt(stat.fg_mais_longo) || 0
                        },
                        punter: {
                            punts: parseInt(stat.punts) || 0,
                            jardas_de_punt: parseInt(stat.jardas_de_punt) || 0
                        }
                    };

                    // Salva as estatísticas deste jogo para este jogador
                    novasEstatisticasJogo.push({
                        jogadorId: jogador.id,
                        timeId: jogadorTime.timeId,
                        temporada,
                        estatisticas: estatisticasDoJogo
                    });

                    // Calcula as novas estatísticas totais
                    const novasEstatisticasTotais = {
                        passe: {
                            passes_completos: (estatisticasAtuais.passe?.passes_completos || 0) + estatisticasDoJogo.passe.passes_completos,
                            passes_tentados: (estatisticasAtuais.passe?.passes_tentados || 0) + estatisticasDoJogo.passe.passes_tentados,
                            jardas_de_passe: (estatisticasAtuais.passe?.jardas_de_passe || 0) + estatisticasDoJogo.passe.jardas_de_passe,
                            td_passados: (estatisticasAtuais.passe?.td_passados || 0) + estatisticasDoJogo.passe.td_passados,
                            interceptacoes_sofridas: (estatisticasAtuais.passe?.interceptacoes_sofridas || 0) + estatisticasDoJogo.passe.interceptacoes_sofridas,
                            sacks_sofridos: (estatisticasAtuais.passe?.sacks_sofridos || 0) + estatisticasDoJogo.passe.sacks_sofridos,
                            fumble_de_passador: (estatisticasAtuais.passe?.fumble_de_passador || 0) + estatisticasDoJogo.passe.fumble_de_passador
                        },
                        corrida: {
                            corridas: (estatisticasAtuais.corrida?.corridas || 0) + estatisticasDoJogo.corrida.corridas,
                            jardas_corridas: (estatisticasAtuais.corrida?.jardas_corridas || 0) + estatisticasDoJogo.corrida.jardas_corridas,
                            tds_corridos: (estatisticasAtuais.corrida?.tds_corridos || 0) + estatisticasDoJogo.corrida.tds_corridos,
                            fumble_de_corredor: (estatisticasAtuais.corrida?.fumble_de_corredor || 0) + estatisticasDoJogo.corrida.fumble_de_corredor
                        },
                        recepcao: {
                            recepcoes: (estatisticasAtuais.recepcao?.recepcoes || 0) + estatisticasDoJogo.recepcao.recepcoes,
                            alvo: (estatisticasAtuais.recepcao?.alvo || 0) + estatisticasDoJogo.recepcao.alvo,
                            jardas_recebidas: (estatisticasAtuais.recepcao?.jardas_recebidas || 0) + estatisticasDoJogo.recepcao.jardas_recebidas,
                            tds_recebidos: (estatisticasAtuais.recepcao?.tds_recebidos || 0) + estatisticasDoJogo.recepcao.tds_recebidos
                        },
                        retorno: {
                            retornos: (estatisticasAtuais.retorno?.retornos || 0) + estatisticasDoJogo.retorno.retornos,
                            jardas_retornadas: (estatisticasAtuais.retorno?.jardas_retornadas || 0) + estatisticasDoJogo.retorno.jardas_retornadas,
                            td_retornados: (estatisticasAtuais.retorno?.td_retornados || 0) + estatisticasDoJogo.retorno.td_retornados
                        },
                        defesa: {
                            tackles_totais: (estatisticasAtuais.defesa?.tackles_totais || 0) + estatisticasDoJogo.defesa.tackles_totais,
                            tackles_for_loss: (estatisticasAtuais.defesa?.tackles_for_loss || 0) + estatisticasDoJogo.defesa.tackles_for_loss,
                            sacks_forcado: (estatisticasAtuais.defesa?.sacks_forcado || 0) + estatisticasDoJogo.defesa.sacks_forcado,
                            fumble_forcado: (estatisticasAtuais.defesa?.fumble_forcado || 0) + estatisticasDoJogo.defesa.fumble_forcado,
                            interceptacao_forcada: (estatisticasAtuais.defesa?.interceptacao_forcada || 0) + estatisticasDoJogo.defesa.interceptacao_forcada,
                            passe_desviado: (estatisticasAtuais.defesa?.passe_desviado || 0) + estatisticasDoJogo.defesa.passe_desviado,
                            safety: (estatisticasAtuais.defesa?.safety || 0) + estatisticasDoJogo.defesa.safety,
                            td_defensivo: (estatisticasAtuais.defesa?.td_defensivo || 0) + estatisticasDoJogo.defesa.td_defensivo
                        },
                        kicker: {
                            xp_bons: (estatisticasAtuais.kicker?.xp_bons || 0) + estatisticasDoJogo.kicker.xp_bons,
                            tentativas_de_xp: (estatisticasAtuais.kicker?.tentativas_de_xp || 0) + estatisticasDoJogo.kicker.tentativas_de_xp,
                            fg_bons: (estatisticasAtuais.kicker?.fg_bons || 0) + estatisticasDoJogo.kicker.fg_bons,
                            tentativas_de_fg: (estatisticasAtuais.kicker?.tentativas_de_fg || 0) + estatisticasDoJogo.kicker.tentativas_de_fg,
                            fg_mais_longo: Math.max(estatisticasAtuais.kicker?.fg_mais_longo || 0, estatisticasDoJogo.kicker.fg_mais_longo)
                        },
                        punter: {
                            punts: (estatisticasAtuais.punter?.punts || 0) + estatisticasDoJogo.punter.punts,
                            jardas_de_punt: (estatisticasAtuais.punter?.jardas_de_punt || 0) + estatisticasDoJogo.punter.jardas_de_punt
                        }
                    };

                    // Atualiza as estatísticas do jogador
                    await tx.jogadorTime.update({
                        where: { id: jogadorTime.id },
                        data: {
                            estatisticas: novasEstatisticasTotais
                        }
                    });

                    resultados.sucesso++;
                } catch (error) {
                    console.error(`Erro ao processar estatísticas para jogador:`, error);
                    resultados.erros.push({
                        jogador: stat.jogador_nome || stat.jogador_id || 'Desconhecido',
                        erro: error instanceof Error ? error.message : 'Erro desconhecido'
                    });
                }
            }

            // Registra as estatísticas originais do jogo para futuras correções
            await tx.metaDados.upsert({
                where: { chave: `estatisticas_jogo_${id_jogo}` },
                update: { valor: JSON.stringify(novasEstatisticasJogo) },
                create: {
                    chave: `estatisticas_jogo_${id_jogo}`,
                    valor: JSON.stringify(novasEstatisticasJogo)
                }
            });

            // Atualiza os metadados do jogo
            jogosProcessados[id_jogo] = {
                dataJogo: data_jogo,
                processadoEm: new Date().toISOString(),
                reprocessado: true
            };

            // Atualiza o registro de jogos processados
            await tx.metaDados.upsert({
                where: { chave: 'jogos_processados' },
                update: { valor: JSON.stringify(jogosProcessados) },
                create: {
                    chave: 'jogos_processados',
                    valor: JSON.stringify(jogosProcessados)
                }
            });

            // Registra informações detalhadas sobre este jogo
            await tx.metaDados.upsert({
                where: { chave: `jogo_${id_jogo}` },
                update: {
                    valor: JSON.stringify({
                        id_jogo,
                        data_jogo,
                        processadoEm: new Date().toISOString(),
                        jogadoresProcessados: resultados.sucesso,
                        nomeArquivo: req.file?.originalname,
                        reprocessado: true
                    })
                },
                create: {
                    chave: `jogo_${id_jogo}`,
                    valor: JSON.stringify({
                        id_jogo,
                        data_jogo,
                        processadoEm: new Date().toISOString(),
                        jogadoresProcessados: resultados.sucesso,
                        nomeArquivo: req.file?.originalname,
                        reprocessado: true
                    })
                }
            });
        });

        // Remove o arquivo após processamento
        fs.unlinkSync(req.file.path);

        res.status(200).json({
            mensagem: `Estatísticas do jogo ${id_jogo} reprocessadas com sucesso para ${resultados.sucesso} jogadores`,
            data_jogo,
            erros: resultados.erros.length > 0 ? resultados.erros : null
        });
    } catch (error) {
        console.error('Erro ao reprocessar estatísticas do jogo:', error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Erro ao reprocessar estatísticas do jogo',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

// ROTA 6: JOGOS PROCESSADOS
mainRouter.get('/jogos-processados', async (req, res) => {
    try {
        console.log('Rota /jogos-processados acessada');

        // Busca o registro de jogos processados
        const metaDados = await prisma.metaDados.findFirst({
            where: { chave: 'jogos_processados' }
        });

        // Caso de nenhum jogo processado
        if (!metaDados || !metaDados.valor) {
            console.log('Nenhum jogo processado encontrado');
            res.status(200).json({ jogos: [] });
            return;
        }

        // Limita o tamanho da resposta se for muito grande
        if (metaDados.valor.length > 5000000) { // ~5MB
            console.warn('Dados muito grandes, enviando versão simplificada');
            res.status(200).json({
                jogos: [],
                error: 'Dados muito grandes para processar',
                message: 'Por favor, contate o administrador do sistema'
            });
            return;
        }

        // Parse do JSON com tratamento de erro
        let jogosProcessados: Record<string, any> = {};
        try {
            const parsed = JSON.parse(metaDados.valor);

            if (typeof parsed !== 'object' || parsed === null) {
                throw new Error('Formato de dados inválido');
            }

            jogosProcessados = parsed as Record<string, any>;

            console.log(`Encontrados ${Object.keys(jogosProcessados).length} jogos processados`);
        } catch (e) {
            console.error('Erro ao fazer parse do JSON de jogos processados:', e);
            res.status(200).json({
                jogos: [],
                error: 'Erro ao processar dados de jogos'
            });
            return;
        }

        // Limitamos a quantidade de jogos para evitar sobrecarga
        const MAX_JOGOS = 100;
        const jogoKeys = Object.keys(jogosProcessados).slice(0, MAX_JOGOS);

        // Transformar de forma otimizada
        const jogosArray = [];
        for (const id_jogo of jogoKeys) {
            const dados = jogosProcessados[id_jogo];
            if (dados && typeof dados === 'object') {
                jogosArray.push({
                    id_jogo,
                    data_jogo: dados.dataJogo || 'Data desconhecida',
                    processado_em: dados.processadoEm || new Date().toISOString(),
                    reprocessado: !!dados.reprocessado
                });
            }
        }

        // Ordenar por data de processamento (mais recente primeiro)
        jogosArray.sort((a, b) => {
            const dateA = new Date(a.processado_em).getTime();
            const dateB = new Date(b.processado_em).getTime();

            if (isNaN(dateA) || isNaN(dateB)) return 0;

            return dateB - dateA;
        });

        res.status(200).json({
            jogos: jogosArray,
            total: Object.keys(jogosProcessados).length,
            limit: MAX_JOGOS
        });
        return;

    } catch (error) {
        console.error('Erro ao buscar jogos processados:', error);
        res.status(200).json({
            jogos: [],
            error: 'Erro interno ao buscar jogos processados'
        });
    }
});

// ROTA ADICIONAL: DELETAR JOGADOR
mainRouter.delete('/jogador/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id)) {
            res.status(400).json({ error: "ID inválido" });
            return;
        }

        const existingJogador = await prisma.jogador.findUnique({
            where: { id },
        });

        if (!existingJogador) {
            res.status(404).json({ error: "Jogador não encontrado" });
            return;
        }

        // Primeiro, exclui todos os vínculos de jogador com times
        await prisma.jogadorTime.deleteMany({
            where: { jogadorId: id },
        });

        // Depois, deleta o jogador do banco de dados
        await prisma.jogador.delete({
            where: { id },
        });

        res.status(200).json({ message: "Jogador excluído com sucesso!" });
    } catch (error) {
        console.error("Erro ao excluir jogador:", error);
        res.status(500).json({ error: "Erro ao excluir jogador" });
    }
});

export default mainRouter
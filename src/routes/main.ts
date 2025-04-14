import { PrismaClient } from '@prisma/client'
import express, { Request, Response } from 'express'
import { TimeSchema } from '../schemas/Time'
import { JogadorSchema } from '../schemas/Jogador'
import { Times } from '../data/times'

const prisma = new PrismaClient()

export const mainRouter = express.Router()

// Rota para obter todos os times com seus jogadores, com filtro opcional de temporada
mainRouter.get('/times', async (req, res) => {
    console.log('Rota /api/times chamada')
    try {
        const { temporada } = req.query
        const temporadaFiltro = temporada ? String(temporada) : '2024' // Default para 2024 se não especificado

        const times = await prisma.time.findMany({
            where: { temporada: temporadaFiltro },
            include: {
                jogadores: {
                    where: { temporada: temporadaFiltro },
                    include: { jogador: true }
                },
            },
        });

        // Transformar os dados para manter compatibilidade com o frontend existente
        const timesFormatados = times.map(time => ({
            ...time,
            jogadores: time.jogadores.map(jt => ({
                ...jt.jogador,
                numero: jt.numero,
                camisa: jt.camisa,
                estatisticas: jt.estatisticas,
                timeId: time.id,
                temporada: jt.temporada
            }))
        }));

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

mainRouter.post('/importar-dados', async (req, res) => {
    try {
        const teamsData = Times;
        const createdTeams = [];

        for (const teamData of teamsData) {
            try {
                // Primeiro cria o time individualmente
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
                });

                createdTeams.push(createdTeam);

                // Depois cria jogadores e vínculos FORA da transação
                if (teamData.jogadores && teamData.jogadores.length > 0) {
                    for (const player of teamData.jogadores) {
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
                        });

                        await prisma.jogadorTime.create({
                            data: {
                                jogadorId: jogadorCriado.id,
                                timeId: createdTeam.id,
                                temporada: teamData.temporada || '2024',
                                numero: player.numero || 0,
                                camisa: player.camisa || '',
                                estatisticas: player.estatisticas || {},
                            },
                        });
                    }
                }

                console.log(`✅ Time ${createdTeam.sigla} e jogadores criados.`);
            } catch (err) {
                console.error(`❌ Erro ao importar o time ${teamData.sigla}:`, err);
            }
        }

        res.status(201).json({ message: 'Importação concluída.', times: createdTeams.length });
    } catch (error) {
        console.error('Erro geral ao importar os dados:', error);
        res.status(500).json({ error: 'Erro ao importar os dados' });
    }
});



// Rota para iniciar nova temporada 
mainRouter.post('/iniciar-temporada/:ano', async (req, res) => {
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

        console.log(`Iniciando criação da temporada ${ano} baseada em ${anoAnterior}`);

        // 1. Obter todos os times da temporada anterior
        const timesAnoAnterior = await prisma.time.findMany({
            where: { temporada: anoAnterior },
        });

        // 2. Mapeamento dos IDs antigos para os novos e nomes antigos para novos
        const mapeamentoIds = new Map();
        const mapeamentoNomes = new Map(); // Adicionado para rastrear mudanças de nome

        // 3. Criar novos times para a nova temporada
        const timesNovos = [];
        for (const time of timesAnoAnterior) {
            const timeId = time.id;
            const nomeAntigo = time.nome; // Guardar nome antigo

            // Verificar se o time sofrerá alterações
            const timeChanges: TimeChange[] = req.body.timeChanges || [];
            const timeChange = timeChanges.find((tc: TimeChange) => tc.timeId === timeId);

            // Nome do time na nova temporada
            const nomeNovo = timeChange?.nome || time.nome;

            const novoTime = await prisma.time.create({
                data: {
                    nome: nomeNovo,
                    sigla: timeChange?.sigla || time.sigla,
                    cor: timeChange?.cor || time.cor,
                    cidade: time.cidade,
                    bandeira_estado: time.bandeira_estado,
                    fundacao: time.fundacao,
                    logo: timeChange?.logo || time.logo,
                    capacete: timeChange?.capacete || time.capacete,
                    instagram: timeChange?.instagram || time.instagram, // Corrigido
                    instagram2: timeChange?.instagram2 || time.instagram2, // Corrigido
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

            // Guardar mapeamento entre ID antigo e novo
            mapeamentoIds.set(timeId, novoTime.id);
            
            // Guardar mapeamento entre nome antigo e novo se houver mudança
            if (nomeAntigo !== nomeNovo) {
                mapeamentoNomes.set(nomeAntigo, {
                    novoNome: nomeNovo,
                    novoId: novoTime.id
                });
            }
            
            timesNovos.push(novoTime);
        }

        // 4. Obter todas as relações jogador-time do ano anterior
        const jogadoresTimesAnoAnterior = await prisma.jogadorTime.findMany({
            where: { temporada: anoAnterior },
            include: { jogador: true, time: true },
        });

        // 5. Conjunto para rastrear jogadores já processados
        const jogadoresProcessados = new Set<number>();

        // 6. Processar as transferências
        const transferencias: Transferencia[] = req.body.transferencias || [];
        for (const transferencia of transferencias) {
            try {
                const jogadorId = transferencia.jogadorId;

                // Verificar se já foi processado
                if (jogadoresProcessados.has(jogadorId)) {
                    continue;
                }

                // Encontrar o jogador
                const jogador = await prisma.jogador.findUnique({
                    where: { id: jogadorId }
                });

                if (!jogador) {
                    continue;
                }

                // Encontrar relação atual
                const relacaoAtual = await prisma.jogadorTime.findFirst({
                    where: {
                        jogadorId: jogadorId,
                        temporada: anoAnterior
                    },
                    include: { time: true }
                });

                if (!relacaoAtual) {
                    continue;
                }

                // Encontrar time de destino - primeiro pelo novoTimeNome
                let timeDestino = await prisma.time.findFirst({
                    where: {
                        nome: transferencia.novoTimeNome,
                        temporada: ano
                    }
                });

                // Se não encontrar o time diretamente, pode ser que o time tenha mudado de nome
                if (!timeDestino && transferencia.novoTimeNome) {
                    // Buscar nos times criados pelo ID fornecido
                    if (transferencia.novoTimeId) {
                        const novoId = mapeamentoIds.get(transferencia.novoTimeId);
                        if (novoId) {
                            timeDestino = await prisma.time.findUnique({
                                where: { id: novoId }
                            });
                        }
                    }
                    
                    // Se ainda não encontrou, procurar pela correspondência de nome
                    if (!timeDestino) {
                        for (const [antigo, info] of mapeamentoNomes.entries()) {
                            if (info.novoNome === transferencia.novoTimeNome) {
                                timeDestino = await prisma.time.findUnique({
                                    where: { id: info.novoId }
                                });
                                break;
                            }
                        }
                    }
                }

                if (!timeDestino) {
                    console.error(`Time destino não encontrado: ${transferencia.novoTimeNome}`);
                    continue;
                }

                // Atualizar posição e setor se necessário
                if (transferencia.novaPosicao || transferencia.novoSetor) {
                    const dadosAtualizacao: { posicao?: string, setor?: string } = {};

                    if (transferencia.novaPosicao) dadosAtualizacao.posicao = transferencia.novaPosicao;
                    if (transferencia.novoSetor) dadosAtualizacao.setor = transferencia.novoSetor;

                    await prisma.jogador.update({
                        where: { id: jogadorId },
                        data: dadosAtualizacao
                    });
                }

                // Criar novo vínculo
                await prisma.jogadorTime.create({
                    data: {
                        jogadorId: jogadorId,
                        timeId: timeDestino.id,
                        temporada: ano,
                        numero: transferencia.novoNumero || relacaoAtual.numero,
                        camisa: transferencia.novaCamisa || relacaoAtual.camisa,
                        estatisticas: {}
                    }
                });

                // Marcar como processado
                jogadoresProcessados.add(jogadorId);

            } catch (error) {
                console.error(`Erro ao processar transferência:`, error);
            }
        }

        // 7. Processar jogadores que não foram transferidos
        for (const jt of jogadoresTimesAnoAnterior) {
            try {
                const jogadorId = jt.jogadorId;

                // Pular jogadores já processados em transferências
                if (jogadoresProcessados.has(jogadorId)) {
                    continue;
                }

                // Obter novo ID do time
                const timeOriginalId = jt.timeId;
                const novoTimeId = mapeamentoIds.get(timeOriginalId);

                if (!novoTimeId) {
                    continue;
                }

                // Criar novo vínculo mantendo o mesmo time
                await prisma.jogadorTime.create({
                    data: {
                        jogadorId: jogadorId,
                        timeId: novoTimeId,
                        temporada: ano,
                        numero: jt.numero,
                        camisa: jt.camisa,
                        estatisticas: {}
                    }
                });

            } catch (error) {
                console.error(`Erro ao processar jogador regular:`, error);
            }
        }

        // 8. Contagem final
        const jogadoresNovaTemporada = await prisma.jogadorTime.count({
            where: { temporada: ano }
        });

        res.status(200).json({
            message: `Temporada ${ano} iniciada com sucesso!`,
            times: timesNovos.length,
            jogadores: jogadoresNovaTemporada
        });

    } catch (error) {
        console.error(`Erro ao iniciar temporada ${req.params.ano}:`, error);
        res.status(500).json({
            error: 'Erro ao iniciar nova temporada',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

export default mainRouter
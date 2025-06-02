export function calcularEstatisticasTimeFA(time: any) {
    const jogadores = time.jogadores.map((jt: any) => ({
        ...jt.jogador,
        estatisticas: jt.estatisticas,
        numero: jt.numero,
        camisa: jt.camisa
    }));

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

export function identificarJogadoresDestaqueFA(time: any) {
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

    destaques.ataque.passador = jogadores
        .filter((j: any) => j.estatisticas?.passe?.td_passados > 0)
        .sort((a: any, b: any) => (b.estatisticas?.passe?.td_passados || 0) - (a.estatisticas?.passe?.td_passados || 0))[0] || null;

    destaques.ataque.corredor = jogadores
        .filter((j: any) => j.estatisticas?.corrida?.jardas_corridas > 0)
        .sort((a: any, b: any) => (b.estatisticas?.corrida?.jardas_corridas || 0) - (a.estatisticas?.corrida?.jardas_corridas || 0))[0] || null;

    destaques.ataque.recebedor = jogadores
        .filter((j: any) => j.estatisticas?.recepcao?.jardas_recebidas > 0)
        .sort((a: any, b: any) => (b.estatisticas?.recepcao?.jardas_recebidas || 0) - (a.estatisticas?.recepcao?.jardas_recebidas || 0))[0] || null;

    destaques.defesa.tackler = jogadores
        .filter((j: any) => j.estatisticas?.defesa?.tackles_totais > 0)
        .sort((a: any, b: any) => (b.estatisticas?.defesa?.tackles_totais || 0) - (a.estatisticas?.defesa?.tackles_totais || 0))[0] || null;

    destaques.defesa.passRush = jogadores
        .filter((j: any) => j.estatisticas?.defesa?.sacks_forcado > 0)
        .sort((a: any, b: any) => (b.estatisticas?.defesa?.sacks_forcado || 0) - (a.estatisticas?.defesa?.sacks_forcado || 0))[0] || null;

    destaques.defesa.interceptador = jogadores
        .filter((j: any) => j.estatisticas?.defesa?.interceptacao_forcada > 0)
        .sort((a: any, b: any) => (b.estatisticas?.defesa?.interceptacao_forcada || 0) - (a.estatisticas?.defesa?.interceptacao_forcada || 0))[0] || null;

    destaques.especialistas.kicker = jogadores
        .filter((j: any) => j.estatisticas?.kicker?.tentativas_de_fg > 0)
        .sort((a: any, b: any) => {
            const eficA = (a.estatisticas?.kicker?.fg_bons || 0) / (a.estatisticas?.kicker?.tentativas_de_fg || 1);
            const eficB = (b.estatisticas?.kicker?.fg_bons || 0) / (b.estatisticas?.kicker?.tentativas_de_fg || 1);
            return eficB - eficA;
        })[0] || null;

    destaques.especialistas.punter = jogadores
        .filter((j: any) => j.estatisticas?.punter?.punts > 0)
        .sort((a: any, b: any) => {
            const mediaA = (a.estatisticas?.punter?.jardas_de_punt || 0) / (a.estatisticas?.punter?.punts || 1);
            const mediaB = (b.estatisticas?.punter?.jardas_de_punt || 0) / (b.estatisticas?.punter?.punts || 1);
            return mediaB - mediaA;
        })[0] || null;

    destaques.especialistas.retornador = jogadores
        .filter((j: any) => j.estatisticas?.retorno?.jardas_retornadas > 0)
        .sort((a: any, b: any) => (b.estatisticas?.retorno?.jardas_retornadas || 0) - (a.estatisticas?.retorno?.jardas_retornadas || 0))[0] || null;

    return destaques;
}
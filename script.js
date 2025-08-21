document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('estadiaForm');

    // URLs das webhooks
    const WEBHOOK_SUBMISSION_URL = 'https://criadordigital-n8n-webhook.kttqgl.easypanel.host/webhook/3d165896-2fb5-47db-a0e9-66c763fd9cec';
    // NOVO: Endpoint para buscar dados de preenchimento
    const WEBHOOK_DATA_FETCH_URL = 'https://criadordigital-n8n-webhook.kttqgl.easypanel.host/webhook/d4d41fd8-84ed-4179-a4df-6a65cec1f878'; 

    // ===== VARIÁVEIS GLOBAIS =====
    let dadosPoliticas = {};
    let dadosProjetos = {};

    // ===== CONFIGURAÇÃO DAS TAXAS DE PAGAMENTO =====
    const taxasPagamento = {
        cartao: {
            1: { nome: 'Cartão - À vista', taxaFixa: 0.00, taxaPercentual: 0.04 },
            6: { nome: 'Cartão - até 6 parcelas sem juros', taxaFixa: 0.00, taxaPercentual: 0.00 }
        },
        pix: {
            1: { nome: 'PIX - À vista', taxaFixa: 0.00, taxaPercentual: 0.08 },
            A: { nome: 'PIX - Opção A', taxaFixa: 0.00, taxaPercentual: 0.08 }
        }
    };

    // ===== FUNÇÃO PARA OBTER FORMAS DE PAGAMENTO PERMITIDAS =====
    function obterFormasPagamentoPermitidas(projeto) {
        if (dadosProjetos.projetos && dadosProjetos.projetos[projeto] && dadosProjetos.projetos[projeto].formas_pagamento_permitidas) {
            return dadosProjetos.projetos[projeto].formas_pagamento_permitidas;
        }
        console.warn(`Formas de pagamento não encontradas para o projeto: ${projeto}. Usando valor padrão: todas.`);
        return ["cartao", "pix", "pix_antecipado", "pix_sinal"];
    }

    // ===== CARREGAMENTO DE DADOS =====
    async function carregarPoliticas() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/andremejitarian/fazendaserrinha_checkout_v2/main/politica_cancelamento.json');
            dadosPoliticas = await response.json();
            console.log('Políticas carregadas:', dadosPoliticas);
        } catch (error) {
            console.error('Erro ao carregar políticas:', error);
            // Fallback com políticas padrão
            dadosPoliticas = {
                "politicas": {
                    "1": {
                        "titulo": "Política de Cancelamento - PIX Antecipado",
                        "texto": "⚠️ **Atenção**: Pagamentos antecipados via PIX não são reembolsáveis. Em caso de cancelamento, será emitido um voucher válido por 12 meses para uso em futuras estadias.",
                        "aplicavel_para": ["pix_antecipado"]
                    },
                    "2": {
                        "titulo": "Política de Cancelamento -- PIX Sinal",
                        "texto": "📋 Em caso de cancelamento da participação, a restituição de valores seguirá os seguintes critérios: Restituição integral, desde que comunicado com antecedência mínima de 30 dias antes do início da data de estadia. Restituição de 50%, desde que comunicado até 15 dias antes do início da data de estadia. Para os outros casos, não haverá restituição.",
                        "aplicavel_para": ["pix_sinal"]
                    },
                    "3": {
                        "titulo": "Política de Cancelamento - Outras Formas",
                        "texto": "🔄 **Cancelamento Flexível**: Cancelamentos até 7 dias antes da chegada: reembolso integral. Entre 3-7 dias: reembolso de 50%. Menos de 3 dias: sem reembolso, mas possibilidade de reagendamento.",
                        "aplicavel_para": ["cartao", "pix_1", "outras"]
                    }
                }
            };
        }
    }

    async function carregarProjetos() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/andremejitarian/fazendaserrinha_checkout_v2/main/projeto.json');
            dadosProjetos = await response.json();
            console.log('Dados de projetos carregados:', dadosProjetos);
            preencherProjetos();
        } catch (error) {
            console.error('Erro ao carregar projetos:', error);
            // Fallback com projetos padrão
            dadosProjetos = {
                "projetos": {
                    "fazenda_serrinha": {
                        "nome": "Fazenda Serrinha",
                        "formas_pagamento_permitidas": ["cartao", "pix", "pix_antecipado", "pix_sinal"],
                        "descricao": "Projeto principal da fazenda com todas as opções de pagamento"
                    }
                }
            };
            preencherProjetos();
        }
    }

    function preencherProjetos() {
        const projetoSelect = document.getElementById('projeto');
        // Clear existing options, but keep the first 'Selecione um projeto' if it's there for manual selection
        const defaultOption = projetoSelect.querySelector('option[value=""][disabled][selected]');
        projetoSelect.innerHTML = ''; // Clear all options
        if (defaultOption) {
            projetoSelect.appendChild(defaultOption);
        } else {
             const newDefaultOption = document.createElement('option');
             newDefaultOption.value = '';
             newDefaultOption.disabled = true;
             newDefaultOption.selected = true;
             newDefaultOption.textContent = 'Selecione um projeto';
             projetoSelect.appendChild(newDefaultOption);
        }
        
        if (dadosProjetos.projetos) {
            Object.entries(dadosProjetos.projetos).forEach(([key, projeto]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = projeto.nome;
                option.title = projeto.descricao;
                projetoSelect.appendChild(option);
            });
        }
    }

    // ===== FUNÇÃO PARA OBTER PROJETO + NOME COMBINADOS =====
    function getProjetoCompleto() {
        const projetoSelecionado = document.getElementById('projeto').value;
        if (!projetoSelecionado) {
            return '';
        }
        let nomeProjeto = '';
        if (dadosProjetos.projetos && dadosProjetos.projetos[projetoSelecionado]) {
            nomeProjeto = dadosProjetos.projetos[projetoSelecionado].nome;
        }
        return nomeProjeto || '';
    }

// ===== FUNÇÃO PARA ATUALIZAR DETALHAMENTO DO PROJETO =====
function atualizarDetalhamentoProjeto() {
    const projetoSelecionado = document.getElementById('projeto').value;
    const detalhamentoContainer = document.getElementById('detalhamentoProjeto');
    const detalhamentoTexto = document.getElementById('detalhamentoTexto');
    
    if (!projetoSelecionado || !dadosProjetos.projetos || !dadosProjetos.projetos[projetoSelecionado]) {
        detalhamentoContainer.style.display = 'none';
        return;
    }
    
    const detalhamento = dadosProjetos.projetos[projetoSelecionado].detalhamento;
    
    if (detalhamento) {
        detalhamentoTexto.textContent = detalhamento;
        detalhamentoContainer.style.display = 'block';
        console.log(`📋 Detalhamento exibido para projeto '${projetoSelecionado}': ${detalhamento}`);
    } else {
        detalhamentoContainer.style.display = 'none';
        console.warn(`⚠️ Detalhamento não encontrado para o projeto: ${projetoSelecionado}`);
    }
}

    // ===== FUNÇÕES DE POLÍTICA DE CANCELAMENTO =====
    function determinarPolitica(formaPagamento) {
        if (!dadosPoliticas || !formaPagamento) {
            return null;
        }
        if (dadosPoliticas.politicas) {
            if (formaPagamento === 'pix_antecipado') {
                return dadosPoliticas.politicas['1'];
            } else if (formaPagamento === 'pix_sinal') {
                return dadosPoliticas.politicas['2'];
            } else if (formaPagamento === 'pix_1') {
                return dadosPoliticas.politicas['3'];
            } else if (formaPagamento === 'cartao_1') {
                return dadosPoliticas.politicas['4'];
            } else if (formaPagamento === 'cartao_6') {
                return dadosPoliticas.politicas['5'];
            } else {
                return dadosPoliticas.politicas['6'];
            }
        }
        console.warn(`Política não encontrada para a forma de pagamento: ${formaPagamento}. Usando política padrão.`);
        return null;
    }

    function exibirPoliticaCancelamento(formaPagamento) {
        const container = document.getElementById('politicaCancelamento');
        const titulo = document.getElementById('politicaTitulo');
        const texto = document.getElementById('politicaTexto');
        
        if (!container || !titulo || !texto) {
            console.warn('⚠️ Elementos da política de cancelamento não encontrados');
            return;
        }
        
        if (!formaPagamento) {
            container.style.display = 'none';
            container.classList.remove('show');
            return;
        }
        
        const politica = determinarPolitica(formaPagamento);
        
        if (!politica) {
            console.warn('⚠️ Política não encontrada para:', formaPagamento);
            container.style.display = 'none';
            container.classList.remove('show');
            return;
        }
        
        titulo.textContent = politica.titulo;
        let textoHTML = politica.texto
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
        
        texto.innerHTML = textoHTML;
        
        container.style.display = 'block';
        setTimeout(() => {
            container.classList.add('show');
        }, 10);
        console.log(`📋 Política exibida: ${politica.titulo} para ${formaPagamento}`);
    }

    // ===== FUNÇÕES DE CÁLCULO DE TAXAS =====
    function calcularValorComTaxas(valorLiquido, tipo, parcelas) {
        if (!tipo || !parcelas || !taxasPagamento[tipo] || !taxasPagamento[tipo][parcelas]) {
            return null;
        }

        const taxa = taxasPagamento[tipo][parcelas];
        const valorNumerico = parseFloat(valorLiquido) || 0;

        if (valorNumerico <= 0) {
            return null;
        }

        const valorBrutoOriginal = (valorNumerico + taxa.taxaFixa) * (1 - taxa.taxaPercentual);
        const valorPorParcelaRaw = valorBrutoOriginal / parcelas;
        const valorPorParcela = Math.floor(valorPorParcelaRaw * 100) / 100;
        const valorBrutoTotalCorrigido = parseFloat((valorPorParcela * parcelas).toFixed(2));

        console.log(`💰 Cálculo de taxa:`, {
            valorLiquido: valorNumerico, tipo: tipo, parcelas: parcelas, formaPagamento: taxa.nome,
            taxaFixa: taxa.taxaFixa, taxaPercentual: (taxa.taxaPercentual * 100).toFixed(2) + '%',
            valorBrutoOriginal: valorBrutoOriginal.toFixed(2),
            valorPorParcelaExibido: valorPorParcela.toFixed(2),
            valorBrutoTotalCorrigido: valorBrutoTotalCorrigido.toFixed(2)
        });
        return {
            total: valorBrutoTotalCorrigido,
            porParcela: valorPorParcela,
            taxa: taxa
        };
    }

    function formatarParaMoeda(valor) {
        if (!valor || isNaN(valor)) return '';
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

function extrairValorNumerico(valorFormatado) {
    if (!valorFormatado) return 0;
    // Corrigido: remove tudo que não é número, vírgula ou ponto
    let valor = valorFormatado.replace(/[^\d,\.]/g, '');
    valor = valor.replace(/\./g, ''); // Remove pontos (separadores de milhares)
    valor = valor.replace(',', '.'); // Troca vírgula por ponto
    return parseFloat(valor) || 0;
}

    function getPaymentTypeName(tipo) {
        if (tipo === 'cartao') return 'Cartão';
        if (tipo === 'pix') return 'PIX';
        return '';
    }

    function permitePagamentoAntecipado() {
        const dataChegada = document.getElementById('dataChegada').value;
        if (!dataChegada) return false;
        const hoje = new Date();
        const chegada = new Date(dataChegada);
        const diferenca = chegada.getTime() - hoje.getTime();
        const diasDiferenca = Math.ceil(diferenca / (1000 * 3600 * 24));
        return diasDiferenca >= 30;
    }

    function permitePagamentoPIXVista() {
        const dataChegada = document.getElementById('dataChegada').value;
        if (!dataChegada) return true;
        const hoje = new Date();
        const chegada = new Date(dataChegada);
        const diferenca = chegada.getTime() - hoje.getTime();
        const diasDiferenca = Math.ceil(diferenca / (1000 * 3600 * 24));
        return diasDiferenca < 30;
    }

    // ===== LÓGICA DE PAGAMENTO =====
    function atualizarFormaPagamento() {
        const projetoSelecionado = document.getElementById('projeto').value;
        const formaPagamentoSelect = document.getElementById('formaPagamento');
        
        if (!projetoSelecionado) {
            formaPagamentoSelect.value = '';
            formaPagamentoSelect.innerHTML = '<option value="" disabled selected>Selecione um projeto primeiro</option>';
            return;
        }
        gerarOpcoesDropdown();
    }

    function gerarOpcoesDropdown() {
        const campoValor = document.getElementById('valor');
        const campoProjeto = document.getElementById('projeto');
        const valorLiquido = extrairValorNumerico(campoValor.value);
        const projetoSelecionado = campoProjeto.value;

        const optgroupCartao = document.getElementById('optgroup-cartao');
        const optgroupPix = document.getElementById('optgroup-pix');

        optgroupCartao.innerHTML = '';
        optgroupPix.innerHTML = '';

        if (!projetoSelecionado) {
            optgroupCartao.innerHTML = '<option value="" disabled>Selecione um projeto primeiro</option>';
            optgroupPix.innerHTML = '<option value="" disabled>Selecione um projeto primeiro</option>';
            return;
        }
        if (valorLiquido <= 0) {
            optgroupCartao.innerHTML = '<option value="" disabled>Informe um valor primeiro</option>';
            optgroupPix.innerHTML = '<option value="" disabled>Informe um valor primeiro</option>';
            return;
        }

        const formasPermitidas = obterFormasPagamentoPermitidas(projetoSelecionado);
        console.log(`🏗️ Formas de pagamento permitidas para ${projetoSelecionado}:`, formasPermitidas);

        if (formasPermitidas.includes('cartao')) {
            for (let parcelas = 1; parcelas <= 12; parcelas++) {
                const calculo = calcularValorComTaxas(valorLiquido, 'cartao', parcelas);
                if (calculo) {
                    const option = document.createElement('option');
                    option.value = `cartao_${parcelas}`;
                    const tipoPagamento = getPaymentTypeName('cartao');
                    if (parcelas === 1) {
                        option.textContent = `À vista no ${tipoPagamento} - ${formatarParaMoeda(calculo.total)}`;
                    } else {
                        option.textContent = `${parcelas}x no ${tipoPagamento} - ${formatarParaMoeda(calculo.porParcela)}/mês (Total: ${formatarParaMoeda(calculo.total)})`;
                    }
                    optgroupCartao.appendChild(option);
                }
            }
        } else {
            optgroupCartao.innerHTML = '<option value="" disabled>Não disponível para este projeto</option>';
        }

        let pixAdicionado = false;

        if (formasPermitidas.includes('pix') && permitePagamentoPIXVista()) {
            const calculo = calcularValorComTaxas(valorLiquido, 'pix', 1);
            if (calculo) {
                const option = document.createElement('option');
                option.value = 'pix_1';
                option.textContent = `À vista no PIX - ${formatarParaMoeda(calculo.total)}`;
                optgroupPix.appendChild(option);
                pixAdicionado = true;
            }
        }

        if (formasPermitidas.includes('pix')) {
            for (let parcelas = 2; parcelas <= 3; parcelas++) {
                const calculo = calcularValorComTaxas(valorLiquido, 'pix', parcelas);
                if (calculo) {
                    const option = document.createElement('option');
                    option.value = `pix_${parcelas}`;
                    option.textContent = `${parcelas}x no PIX - ${formatarParaMoeda(calculo.porParcela)}/mês (Total: ${formatarParaMoeda(calculo.total)})`;
                    optgroupPix.appendChild(option);
                    pixAdicionado = true;
                }
            }
        }

        if (formasPermitidas.includes('pix_antecipado') && permitePagamentoAntecipado()) {
            const valorComDesconto = valorLiquido * 0.87;
            const option1 = document.createElement('option');
            option1.value = 'pix_antecipado';
            option1.textContent = `PIX Antecipado - ${formatarParaMoeda(valorComDesconto)}`;
            optgroupPix.appendChild(option1);
            pixAdicionado = true;
        }

        if (formasPermitidas.includes('pix_sinal')) {
            const valorSinal = valorLiquido * 0.30 * 0.92;
            const valorRestante = valorLiquido * 0.70 * 0.92;
            const option2 = document.createElement('option');
            option2.value = 'pix_sinal';
            option2.textContent = `PIX Sinal - 30% agora (${formatarParaMoeda(valorSinal)}) + 70% no check-out (${formatarParaMoeda(valorRestante)}) (Total: ${formatarParaMoeda(valorLiquido * 0.92)})`;
            optgroupPix.appendChild(option2);
            pixAdicionado = true;
        }

        if (!pixAdicionado) {
            optgroupPix.innerHTML = '<option value="" disabled>Não disponível para este projeto</option>';
        }
    }

    function atualizarValorCalculado() {
        const campoValor = document.getElementById('valor');
        const campoFormaPagamento = document.getElementById('formaPagamento');
        const campoValorCalculado = document.getElementById('valorCalculado');

        if (!campoValor || !campoFormaPagamento || !campoValorCalculado) {
            console.warn('⚠️ Campos necessários não encontrados');
            return;
        }

        const valorLiquido = extrairValorNumerico(campoValor.value);
        const formaPagamento = campoFormaPagamento.value;

        console.log(`🔄 Atualizando cálculo - Valor: ${valorLiquido}, Forma: ${formaPagamento}`);

        if (!formaPagamento) {
            campoValorCalculado.value = '';
            campoValorCalculado.placeholder = 'Selecione uma forma de pagamento';
            exibirPoliticaCancelamento(null);
            return;
        }

        if (valorLiquido <= 0) {
            campoValorCalculado.value = '';
            campoValorCalculado.placeholder = 'Informe um valor válido';
            exibirPoliticaCancelamento(null);
            return;
        }

        if (formaPagamento === 'pix_antecipado') {
            const valorComDesconto = valorLiquido * 0.87;
            campoValorCalculado.value = formatarParaMoeda(valorComDesconto);
            campoValorCalculado.placeholder = '';
            exibirPoliticaCancelamento(formaPagamento);
            return;
        }

        if (formaPagamento === 'pix_sinal') {
            campoValorCalculado.value = formatarParaMoeda(valorLiquido * 0.92);
            campoValorCalculado.placeholder = '';
            exibirPoliticaCancelamento(formaPagamento);
            return;
        }

        const [tipo, parcelas] = formaPagamento.split('_');
        const calculo = calcularValorComTaxas(valorLiquido, tipo, parseInt(parcelas));

        if (calculo) {
            campoValorCalculado.value = formatarParaMoeda(calculo.total);
            campoValorCalculado.placeholder = '';
            if (calculo.total > valorLiquido) {
                const diferenca = calculo.total - valorLiquido;
                console.log(`💡 Taxa aplicada: ${formatarParaMoeda(diferenca)}`);
            }
        } else {
            campoValorCalculado.value = '';
            campoValorCalculado.placeholder = 'Erro no cálculo';
        }
        exibirPoliticaCancelamento(formaPagamento);
    }

    function obterDadosFormaPagamento(formaPagamento) {
        if (!formaPagamento) return null;
        if (formaPagamento === 'pix_antecipado') {
            return { tipo: 'pix_antecipado', parcelas: 1, nome: 'PIX Antecipado', taxa: { taxaFixa: 0, taxaPercentual: 0 } };
        }
        if (formaPagamento === 'pix_sinal') {
            return { tipo: 'pix_sinal', parcelas: 1, nome: 'PIX Sinal - 30% + 70% no check-out', taxa: { taxaFixa: 0, taxaPercentual: 0 } };
        }
        const [tipo, parcelas] = formaPagamento.split('_');
        const parcelasNum = parseInt(parcelas);
        if (taxasPagamento[tipo] && taxasPagamento[tipo][parcelasNum]) {
            return { tipo: tipo, parcelas: parcelasNum, nome: taxasPagamento[tipo][parcelasNum].nome, taxa: taxasPagamento[tipo][parcelasNum] };
        }
        return null;
    }

    // ===== NOVA FUNÇÃO: OBTER reserva DA URL =====
    function obterreservaURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('reserva');
    }

    // ===== NOVA FUNÇÃO: BUSCAR DADOS VIA API =====
    async function fetchDadosN8N(reserva) {
        if (!reserva) {
            console.log('ℹ️ Nenhum reserva na URL para buscar dados.');
            return null;
        }

        try {
            const response = await fetch(`${WEBHOOK_DATA_FETCH_URL}?reserva=${reserva}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao buscar dados: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ Erro no fetch de dados do n8n:', error);
            mostrarMensagem(`❌ Erro ao carregar dados de reserva: ${error.message}.`, 'erro');
            return null;
        }
    }

    // ===== FUNÇÃO PARA BLOQUEAR CAMPOS =====
    function bloquearCampo(elemento, motivo = 'Campo preenchido automaticamente', ocultar = false) {
        if (elemento) {
            elemento.readOnly = true;
            elemento.disabled = true;
            
            if (ocultar) {
                const container = elemento.closest('.form-group') || elemento.parentElement;
                if (container) {
                    container.style.display = 'none';
                } else {
                    elemento.style.display = 'none';
                }
            } else {
                elemento.style.backgroundColor = '#f5f5f5';
                elemento.style.color = '#666';
                elemento.style.cursor = 'not-allowed';
            }
            
            elemento.title = motivo;
            elemento.classList.add('campo-bloqueado');
            
            console.log(`🔒 Campo '${elemento.id}' foi ${ocultar ? 'ocultado' : 'bloqueado'}: ${motivo}`);
        }
    }

// ===== NOVA FUNÇÃO: PREENCHER CAMPOS VIA API (CORRIGIDA) =====
async function preencherCamposViaAPI(responseData) {
    if (!responseData || Object.keys(responseData).length === 0) {
        console.log('ℹ️ Nenhum dado para preencher via API.');
        return;
    }

    console.log('🚀 Dados recebidos da API:', responseData);

    // Extrai os dados da estrutura do n8n
    let data = responseData;
    if (responseData.data && typeof responseData.data === 'object') {
        data = responseData.data;
        console.log('📦 Dados extraídos:', data);
    }

    // Verifica se a resposta indica erro
    if (responseData.ok === false) {
        console.warn('⚠️ API retornou erro:', responseData.error || responseData.message);
        mostrarMensagem(`⚠️ ${responseData.message || 'Erro ao carregar dados de reserva'}`, 'erro');
        return;
    }

    console.log('🚀 Preenchendo campos automaticamente com dados da API...', data);

    // Mapeamento atualizado baseado na sua estrutura atual
    const mapeamentoCampos = {
        'descricao': 'descricao',
        'valor': 'valor',
        'reserva': 'reserva',
        'nomeCompleto': 'nomeCompleto',
        'cpf': 'cpf',
        'email': 'email',
        'celular': 'celular',
        'projeto': 'projeto',
        'formaPagamento': 'formaPagamento',
        'dataChegada': 'dataChegada',
        'dataSaida': 'dataSaida'
    };

    for (const [api_key, form_id] of Object.entries(mapeamentoCampos)) {
        if (data.hasOwnProperty(api_key) && data[api_key] !== null && data[api_key] !== undefined) {
            const elemento = document.getElementById(form_id);
            const valorOriginal = data[api_key];
            const valorDecodificado = String(valorOriginal);

            if (elemento) {
                console.log(`🔄 Preenchendo campo '${form_id}' com valor '${valorDecodificado}'`);
                
                switch (form_id) {
                    case 'cpf':
                        const cpfLimpo = valorDecodificado.replace(/\D/g, '');
                        elemento.value = cpfLimpo;
                        elemento.dispatchEvent(new Event('input'));
                        bloquearCampo(elemento, 'CPF definido via API - não pode ser alterado');
                        break;

                    case 'celular':
                        const celularLimpo = valorDecodificado.replace(/\D/g, '');
                        elemento.value = celularLimpo;
                        elemento.dispatchEvent(new Event('input'));
                        bloquearCampo(elemento, 'Celular definido via API - não pode ser alterado');
                        break;

                    case 'valor':
                        console.log(`💰 Processando valor: ${valorOriginal} (tipo: ${typeof valorOriginal})`);
                        
                        let valorNumerico;
                        if (typeof valorOriginal === 'number') {
                            valorNumerico = valorOriginal;
                        } else if (typeof valorOriginal === 'string') {
                            if (valorOriginal.includes('R$')) {
                                elemento.value = valorOriginal;
                                elemento.setAttribute('data-api-preenchido', 'true');
                                break;
                            } else {
                                valorNumerico = parseFloat(valorOriginal.replace(',', '.')) || 0;
                            }
                        }
                        
                        if (valorNumerico && valorNumerico > 0) {
                            const valorFormatado = valorNumerico.toFixed(2)
                                .replace('.', ',')
                                .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                            const valorFinal = 'R$ ' + valorFormatado;
                            
                            console.log(`💰 Valor formatado: ${valorFinal}`);
                            elemento.value = valorFinal;
                            elemento.dispatchEvent(new Event('input'));
                            elemento.dispatchEvent(new Event('blur'));
                            
                            // NÃO bloqueia imediatamente - será bloqueado depois
                            elemento.setAttribute('data-api-preenchido', 'true');
                        }
                        break;

case 'descricao':
    elemento.value = valorDecodificado;
    // Oculta o campo input
    elemento.style.display = 'none';
    // Oculta o label também
    const label = elemento.previousElementSibling;
    if (label && label.tagName === 'LABEL') {
        label.style.display = 'none';
    }
    
    // Exibe o texto da descrição
    const descricaoContainer = document.getElementById('descricaoTextoContainer');
    const descricaoTexto = document.getElementById('descricaoTextoExibicao');
    if (descricaoContainer && descricaoTexto) {
        descricaoTexto.innerHTML = `<strong>Detalhamento:</strong> ${valorDecodificado}`;
        descricaoContainer.style.display = 'block';
    }
    
    console.log(`✅ Descrição carregada via API: ${valorDecodificado}`);
    break;

                    case 'dataChegada':
                    case 'dataSaida':
                        const dataFormatada = formatarDataParaInput(valorDecodificado);
                        if (dataFormatada) {
                            elemento.value = dataFormatada;
                        bloquearCampo(elemento, `${elemento.labels[0]?.textContent?.replace('*', '').trim() || 'Data'} definido via API - não pode ser alterado`);
                        }
                        break;

                    case 'projeto':
                        // Aguarda os projetos serem carregados antes de definir
                        setTimeout(() => {
                            if (dadosProjetos.projetos && dadosProjetos.projetos[valorDecodificado]) {
                                elemento.value = valorDecodificado;
                                bloquearCampo(elemento, 'Projeto definido via API - não pode ser alterado');
                                elemento.dispatchEvent(new Event('change'));
                                atualizarDetalhamentoProjeto();
                            } else {
                                console.warn(`⚠️ Projeto inválido '${valorDecodificado}' recebido da API.`);
                            }
                        }, 500);
                        break;

                    case 'formaPagamento':
                        // Aguarda as opções serem geradas antes de definir
                        setTimeout(() => {
                            if (valorDecodificado) {
                                elemento.value = valorDecodificado;
                                bloquearCampo(elemento, 'Forma de pagamento definida via API - não pode ser alterada');
                                elemento.dispatchEvent(new Event('change'));
                            }
                        }, 1000);
                        break;

                    default:
                        elemento.value = valorDecodificado;
                        if (elemento.labels && elemento.labels.length > 0) {
                            bloquearCampo(elemento, `${elemento.labels[0].textContent.replace('*', '').trim()} definido via API - não pode ser alterado`);
                        } else {
                            bloquearCampo(elemento, 'Campo preenchido via API - não pode ser alterado');
                        }
                        break;
                }
                
                elemento.classList.add('preenchido-automaticamente');
                console.log(`✅ Campo '${form_id}' preenchido com sucesso`);
            } else {
                console.warn(`⚠️ Campo '${form_id}' não encontrado no formulário.`);
            }
        }
    }

    // Delay maior para garantir que todos os campos sejam populados
    setTimeout(() => {
        console.log('🔄 Atualizando opções de pagamento e cálculos...');
        gerarOpcoesDropdown();
        atualizarValorCalculado();
        
        // AGORA bloqueia o campo valor se foi preenchido pela API
        const campoValor = document.getElementById('valor');
        if (campoValor && campoValor.getAttribute('data-api-preenchido') === 'true') {
            bloquearCampo(campoValor, 'Valor definido via API - campo oculto');
        }
    }, 1500);
} // <-- ESTA CHAVE ESTAVA FALTANDO!

    
// ===== NOVA FUNÇÃO: OBTER reserva DA URL E ARMAZENAR =====
function obterreservaURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const numeroReserva = urlParams.get('reserva');
    
    // Armazena o número da reserva no campo oculto
    if (numeroReserva) {
        const campoReserva = document.getElementById('numeroReserva');
        if (campoReserva) {
            campoReserva.value = numeroReserva;
            console.log('📋 Número da reserva armazenado:', numeroReserva);
        }
    }
    
    return numeroReserva;
}


    // Função auxiliar para formatar datas (já existente e reutilizada)
function formatarDataParaInput(dataString) {
    try {
        console.log(`🔄 Formatando data de entrada: "${dataString}"`);
        
        let data;
        
        // Se já está no formato datetime-local (YYYY-MM-DDTHH:mm)
        if (dataString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
            console.log(`✅ Data já no formato correto: ${dataString}`);
            return dataString;
        }
        
        // Se está no formato de data ISO com horário (YYYY-MM-DDTHH:mm:ss)
        if (dataString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
            const resultado = dataString.substring(0, 16); // Remove os segundos
            console.log(`✅ Data ISO convertida: ${resultado}`);
            return resultado;
        }
        
        // CORRIGIDO: Se está no formato brasileiro com horário (DD/MM/YYYY HH:mm)
        if (dataString.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}\s\d{2}:\d{2}$/)) {
            const [datePart, timePart] = dataString.split(' ');
            const partes = datePart.split(/[\/\-]/);
            // CORREÇÃO: partes[0] = dia, partes[1] = mês, partes[2] = ano
            const resultado = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}T${timePart}`;
            console.log(`✅ Data brasileira com horário convertida: ${dataString} → ${resultado}`);
            return resultado;
        }
        
        // CORRIGIDO: Se está no formato brasileiro apenas data (DD/MM/YYYY)
        if (dataString.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)) {
            const partes = dataString.split(/[\/\-]/);
            // CORREÇÃO: partes[0] = dia, partes[1] = mês, partes[2] = ano
            const resultado = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}T12:00`;
            console.log(`✅ Data brasileira sem horário convertida: ${dataString} → ${resultado}`);
            return resultado;
        }
        
        // Se está no formato ISO apenas data (YYYY-MM-DD)
        if (dataString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const resultado = `${dataString}T12:00`;
            console.log(`✅ Data ISO sem horário convertida: ${resultado}`);
            return resultado;
        }
        
        // NOVO: Tratamento para formato brasileiro com ano de 2 dígitos (DD/MM/YY HH:mm)
        if (dataString.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{2}\s\d{2}:\d{2}$/)) {
            const [datePart, timePart] = dataString.split(' ');
            const partes = datePart.split(/[\/\-]/);
            const ano = parseInt(partes[2]) + (parseInt(partes[2]) > 50 ? 1900 : 2000);
            const resultado = `${ano}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}T${timePart}`;
            console.log(`✅ Data brasileira YY com horário convertida: ${dataString} → ${resultado}`);
            return resultado;
        }
        
        // NOVO: Tratamento para formato brasileiro com ano de 2 dígitos (DD/MM/YY)
        if (dataString.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{2}$/)) {
            const partes = dataString.split(/[\/\-]/);
            const ano = parseInt(partes[2]) + (parseInt(partes[2]) > 50 ? 1900 : 2000);
            const resultado = `${ano}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}T12:00`;
            console.log(`✅ Data brasileira YY sem horário convertida: ${dataString} → ${resultado}`);
            return resultado;
        }
        
        // Tenta converter outros formatos usando Date (com cuidado)
        console.log(`⚠️ Tentando conversão genérica para: ${dataString}`);
        data = new Date(dataString);
        if (isNaN(data.getTime())) {
            console.warn(`⚠️ Data inválida: ${dataString}`);
            return null;
        }
        
        // Converte para formato datetime-local
        const year = data.getFullYear();
        const month = String(data.getMonth() + 1).padStart(2, '0');
        const day = String(data.getDate()).padStart(2, '0');
        const hours = String(data.getHours()).padStart(2, '0');
        const minutes = String(data.getMinutes()).padStart(2, '0');
        
        const resultado = `${year}-${month}-${day}T${hours}:${minutes}`;
        console.log(`✅ Data genérica convertida: ${dataString} → ${resultado}`);
        return resultado;
    } catch (error) {
        console.warn(`⚠️ Erro ao formatar data '${dataString}':`, error);
        return null;
    }
}

    // ===== NOVA FUNÇÃO: INICIALIZAR FORMULÁRIO (Orquestra o carregamento e preenchimento) =====
    async function inicializarFormulario() {
        const reserva = obterreservaURL();
        if (reserva) {
            const dadosAPI = await fetchDadosN8N(reserva);
            if (dadosAPI) {
                await preencherCamposViaAPI(dadosAPI);
            }
        } else {
            console.log('ℹ️ Nenhuma reserva de reserva encontrado na URL. Formulário será preenchido manualmente.');
        }

        // Essas chamadas são essenciais, independentemente do pré-preenchimento via API,
        // pois alguns campos podem ser definidos pelo usuário ou o formulário pode ser vazio.
        gerarOpcoesDropdown();
        atualizarValorCalculado();
    }

    // ===== NAVEGAÇÃO ENTRE TELAS =====
    window.showFormScreen = function() {
        document.getElementById('welcomeScreen').classList.remove('active');
        document.getElementById('formScreen').classList.add('active');
    }

    window.showWelcomeScreen = function() {
        document.getElementById('formScreen').classList.remove('active');
        document.getElementById('welcomeScreen').classList.add('active');
    }

    window.showPaymentScreen = function(paymentUrl) {
        document.getElementById('welcomeScreen').classList.remove('active');
        document.getElementById('formScreen').classList.remove('active');
        document.getElementById('paymentScreen').classList.add('active');
        
        const paymentButton = document.getElementById('paymentButton');
        if (paymentButton && paymentUrl) {
            paymentButton.href = paymentUrl;
            console.log('🔗 Link de pagamento configurado:', paymentUrl);
        }
    }

    window.restartProcess = function() {
        form.reset();
        document.getElementById('valorCalculado').value = '';
        document.getElementById('valorCalculado').placeholder = 'Selecione uma forma de pagamento';
        document.getElementById('projeto').value = '';
        document.getElementById('optgroup-cartao').innerHTML = '';
        document.getElementById('optgroup-pix').innerHTML = '';
        
        const container = document.getElementById('politicaCancelamento');
        if (container) {
            container.style.display = 'none';
            container.classList.remove('show');
        }
        
        document.getElementById('paymentScreen').classList.remove('active');
        document.getElementById('formScreen').classList.remove('active');
        document.getElementById('welcomeScreen').classList.add('active');
        
        console.log('🔄 Processo reiniciado');
    }

    // ===== MÁSCARAS DE FORMATAÇÃO =====
    document.getElementById('cpf').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        e.target.value = value;
    });

    document.getElementById('celular').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        if (value.length <= 10) {
            value = value.replace(/(\d{2})(\d)/, '($1) $2');
            value = value.replace(/(\d{4})(\d)/, '$1-$2');
        } else {
            value = value.replace(/(\d{2})(\d)/, '($1) $2');
            value = value.replace(/(\d{5})(\d)/, '$1-$2');
        }
        e.target.value = value;
    });

    document.getElementById('valor').addEventListener('input', function(e) {
        if (e.target.classList.contains('campo-bloqueado')) return;
        let value = e.target.value.replace(/\D/g, '');
        if (!value) {
            e.target.value = '';
            gerarOpcoesDropdown();
            atualizarValorCalculado();
            return;
        }
        value = (parseInt(value) / 100).toFixed(2);
        value = value.replace('.', ',');
        value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        e.target.value = 'R$ ' + value;
        gerarOpcoesDropdown();
        atualizarValorCalculado();
    });

    document.getElementById('valor').addEventListener('blur', function(e) {
        if (e.target.classList.contains('campo-bloqueado')) return;
        let value = e.target.value;
        if (value && !value.startsWith('R$ ')) {
            let numericValue = value.replace(/\D/g, '');
            if (numericValue) {
                numericValue = (parseInt(numericValue) / 100).toFixed(2);
                numericValue = numericValue.replace('.', ',');
                numericValue = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                e.target.value = 'R$ ' + numericValue;
            }
        }
        atualizarValorCalculado();
    });

    document.getElementById('formaPagamento').addEventListener('change', function(e) {
        console.log(`💳 Forma de pagamento alterada para: ${e.target.value}`);
        atualizarValorCalculado();
    });

    document.getElementById('projeto').addEventListener('change', function(e) {
        console.log(`🏗️ Projeto alterado para: ${e.target.value}`);
        document.getElementById('formaPagamento').value = '';
        document.getElementById('valorCalculado').value = '';
        document.getElementById('valorCalculado').placeholder = 'Selecione uma forma de pagamento';
        exibirPoliticaCancelamento(null);
        atualizarDetalhamentoProjeto();
        atualizarFormaPagamento();
    });

document.getElementById('dataChegada').addEventListener('change', function(e) {
    console.log(`📅 Data e hora de chegada alterada para: ${e.target.value}`);
    gerarOpcoesDropdown();
    atualizarValorCalculado();
});

// Adicione também para dataSaida se necessário
document.getElementById('dataSaida').addEventListener('change', function(e) {
    console.log(`�� Data e hora de saída alterada para: ${e.target.value}`);
    // Pode adicionar validações adicionais aqui se necessário
});

    // ===== VALIDAÇÃO DE CPF LOCAL =====
    function validarCPF(cpf) {
        cpf = cpf.replace(/\D/g, '');
        if (cpf.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        const base = cpf.slice(0, 9);
        const dvInformado = cpf.slice(9, 11);
        const calcularDV = (base, pesoInicial) => {
            const soma = base.split('').reduce((accumulator, num, index) => {
                return accumulator + parseInt(num) * (pesoInicial - index);
            }, 0);
            const resto = soma % 11;
            return (resto < 2) ? '0' : String(11 - resto);
        };
        const dv1 = calcularDV(base, 10);
        const dv2 = calcularDV(base + dv1, 11);
        return dv1 + dv2 === dvInformado;
    }

    // ===== FUNÇÕES AUXILIARES =====

    function mostrarMensagem(texto, tipo = 'sucesso') {
        const mensagemExistente = document.querySelector('.mensagem-feedback');
        if (mensagemExistente) {
            mensagemExistente.remove();
        }
        const mensagem = document.createElement('div');
        mensagem.className = `mensagem-feedback ${tipo}`;
        mensagem.innerHTML = `
            <div class="mensagem-conteudo">
                <span class="mensagem-icone">${tipo === 'sucesso' ? '✅' : tipo === 'erro' ? '❌' : 'ℹ️'}</span>
                <span class="mensagem-texto">${texto}</span>
            </div>
        `;
        document.body.appendChild(mensagem);
        setTimeout(() => {
            if (mensagem.parentNode) {
                mensagem.style.opacity = '0';
                setTimeout(() => mensagem.remove(), 300);
            }
        }, 5000);
    }

    async function enviarParaN8N(dadosFormulario) {
        try {
            const response = await fetch(WEBHOOK_SUBMISSION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    ...dadosFormulario,
                    metadata: {
                        timestamp: new Date().toISOString(),
                        source: 'formulario-check-in-fazenda',
                        userAgent: navigator.userAgent,
                        url: window.location.href
                    }
                })
            });
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
            }
            let responseData;
            try {
                responseData = await response.json();
            } catch (e) {
                responseData = await response.text();
            }
            console.log('✅ Sucesso - Resposta do n8n:', responseData);
            return { success: true, data: responseData };
        } catch (error) {
            console.error('❌ Erro ao enviar para n8n:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== MANIPULADOR DO FORMULÁRIO =====
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitButton = document.querySelector('.submit-button');
        const textoOriginal = submitButton.innerHTML;
        submitButton.innerHTML = '<span class="loading-spinner"></span> Validando dados...';
        submitButton.disabled = true;
        submitButton.style.opacity = '0.7';

        const dadosFormaPagamento = obterDadosFormaPagamento(document.getElementById('formaPagamento').value);
const valorLiquido = extrairValorNumerico(document.getElementById('valor').value);

        let valorCalculadoNumerico;
        const formaPagamento = document.getElementById('formaPagamento').value;
        if (formaPagamento === 'pix_antecipado') {
            valorCalculadoNumerico = valorLiquido * 0.95; // Este valor foi um exemplo no script anterior, verifique a lógica de desconto
        } else if (formaPagamento === 'pix_sinal' || formaPagamento === 'pix_1'){
            valorCalculadoNumerico = valorLiquido * 0.98; // Este valor foi um exemplo no script anterior, verifique a lógica de desconto
        } else {
            valorCalculadoNumerico = extrairValorNumerico(document.getElementById('valorCalculado').value);
        }

        const projetoCompleto = getProjetoCompleto();
        
        const formData = {
            nomeCompleto: document.getElementById('nomeCompleto').value.trim(),
            cpf: document.getElementById('cpf').value,
            cpfLimpo: document.getElementById('cpf').value.replace(/[^\d]/g, ''),
            email: document.getElementById('email').value.trim().toLowerCase(),
            celular: document.getElementById('celular').value,
            celularLimpo: document.getElementById('celular').value.replace(/[^\d]/g, ''),
            descricao: document.getElementById('descricao').value.trim(),
            projeto: document.getElementById('projeto').value,
            projetoNome: projetoCompleto,
            valor: document.getElementById('valor').value,
            valorNumerico: valorLiquido,
            formaPagamento: formaPagamento,
            formaPagamentoTipo: dadosFormaPagamento?.tipo || '',
            formaPagamentoParcelas: dadosFormaPagamento?.parcelas || 0,
            formaPagamentoNome: dadosFormaPagamento?.nome || '',
            valorCalculado: document.getElementById('valorCalculado').value,
            valorCalculadoNumerico: valorCalculadoNumerico,
            dataChegada: document.getElementById('dataChegada').value,
            dataSaida: document.getElementById('dataSaida').value,
    dataChegadaFormatada: formatarDataParaExibicao(document.getElementById('dataChegada').value),
    dataSaidaFormatada: formatarDataParaExibicao(document.getElementById('dataSaida').value),
            aceitoRegulamento: document.getElementById('aceitoRegulamento').checked,
numeroReserva: document.getElementById('numeroReserva').value || null,
            comunicacoesFazenda: document.querySelector('input[name="comunicacoesFazenda"]:checked') ?
                document.querySelector('input[name="comunicacoesFazenda"]:checked').value : 'não informado'
        };

        function restaurarBotao() {
            submitButton.innerHTML = textoOriginal;
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
        }

        // ===== VALIDAÇÕES =====
        if (!formData.projeto) {
            restaurarBotao();
            mostrarMensagem('Por favor, selecione um projeto.', 'erro');
            return;
        }
        if (!formData.aceitoRegulamento) {
            restaurarBotao();
            mostrarMensagem('Você deve aceitar o Regulamento Interno para prosseguir.', 'erro');
            return;
        }
        console.log('🔍 Validando CPF localmente:', formData.cpfLimpo);
        if (!validarCPF(formData.cpf)) {
            restaurarBotao();
            mostrarMensagem('❌ CPF inválido. Por favor, verifique e digite um CPF válido.', 'erro');
            return;
        }
        console.log('✅ CPF válido!');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            restaurarBotao();
            mostrarMensagem('Por favor, insira um email válido.', 'erro');
            return;
        }
        if (formData.celularLimpo.length < 10) {
            restaurarBotao();
            mostrarMensagem('Por favor, insira um número de celular válido.', 'erro');
            return;
        }
        if (formData.descricao.length < 3) {
            restaurarBotao();
            mostrarMensagem('O nome do evento deve ter pelo menos 3 caracteres.', 'erro');
            return;
        }
        if (formData.valorNumerico <= 0) {
            restaurarBotao();
            mostrarMensagem('Por favor, insira um valor válido maior que zero.', 'erro');
            return;
        }
        if (!formData.formaPagamento) {
            restaurarBotao();
            mostrarMensagem('Por favor, selecione uma forma de pagamento.', 'erro');
            return;
        }

        const formasPermitidas = obterFormasPagamentoPermitidas(formData.projeto);
        const [tipoFormaPagamento] = formData.formaPagamento.split('_');
        
        if (!formasPermitidas.includes(tipoFormaPagamento) && !formasPermitidas.includes(formData.formaPagamento)) { // Verifica também o tipo completo para pix_antecipado/sinal
            restaurarBotao();
            mostrarMensagem('A forma de pagamento selecionada não é permitida para este projeto.', 'erro');
            return;
        }

        if (formData.formaPagamento === 'pix_antecipado' && !permitePagamentoAntecipado()) {
            restaurarBotao();
            mostrarMensagem('O pagamento antecipado com desconto só está disponível até 30 dias antes da data de chegada.', 'erro');
            return;
        }
        if (formData.valorCalculadoNumerico <= 0) {
            restaurarBotao();
            mostrarMensagem('Erro no cálculo do valor. Verifique os dados informados.', 'erro');
            return;
        }

// ===== VALIDAÇÕES DE DATA E HORA =====
const hoje = new Date();
const chegada = new Date(formData.dataChegada);
const saida = new Date(formData.dataSaida);
const dataLimite = new Date();
dataLimite.setDate(hoje.getDate() - 60);

// Validação de data de chegada
if (chegada < dataLimite) {
    restaurarBotao();
    mostrarMensagem('A data de chegada não pode ser anterior a 60 dias da data atual.', 'erro');
    return;
}

// Validação de data de saída
if (saida <= chegada) {
    restaurarBotao();
    mostrarMensagem('A data e hora de saída deve ser posterior à data e hora de chegada.', 'erro');
    return;
}

        const chegadaNormalizada = new Date(chegada);
        chegadaNormalizada.setHours(0, 0, 0, 0);
        const saidaNormalizada = new Date(saida);
        saidaNormalizada.setHours(0, 0, 0, 0);

        if (chegadaNormalizada < dataLimite) {
            restaurarBotao();
            mostrarMensagem('A data de chegada não pode ser anterior a 60 dias da data atual.', 'erro');
            return;
        }
        if (saidaNormalizada <= chegadaNormalizada) {
            restaurarBotao();
            mostrarMensagem('A data de saída deve ser posterior à data de chegada.', 'erro');
            return;
        }

        submitButton.innerHTML = '<span class="loading-spinner"></span> Enviando dados...';

        console.log('Payload final completo:', formData);
        console.log('Campo projeto no payload:', formData.projeto);
        console.log('Campo projetoNome no payload:', formData.projetoNome);

        console.log('📦 Enviando dados para n8n...', formData);
        const resultado = await enviarParaN8N(formData);
        if (resultado.success) {
            restaurarBotao();
            let paymentUrl = null;
            if (typeof resultado.data === 'string') {
                paymentUrl = resultado.data.trim();
            } else if (resultado.data && typeof resultado.data === 'object') {
                paymentUrl = resultado.data.url || 
                           resultado.data.payment_url || 
                           resultado.data.link || 
                           resultado.data.checkout_url ||
                           resultado.data.paymentUrl;
            }
            
            console.log('🔗 URL de pagamento extraída:', paymentUrl);
            
            if (paymentUrl && (paymentUrl.startsWith('http://') || paymentUrl.startsWith('https://'))) {
                showPaymentScreen(paymentUrl);
            } else {
                mostrarMensagem('✅ Check-in realizado com sucesso! Dados enviados para processamento.');
                setTimeout(() => {
                    restartProcess();
                }, 3000);
            }
        } else {
            restaurarBotao();
            mostrarMensagem(`❌ Erro ao processar check-in: ${resultado.error}. Tente novamente.`, 'erro');
        }
    });

// ===== FUNÇÃO AUXILIAR PARA FORMATAÇÃO DE EXIBIÇÃO =====
function formatarDataParaExibicao(datetimeLocal) {
    if (!datetimeLocal) return '';
    
    try {
        const data = new Date(datetimeLocal);
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        const horas = String(data.getHours()).padStart(2, '0');
        const minutos = String(data.getMinutes()).padStart(2, '0');
        
        return `${dia}/${mes}/${ano} às ${horas}:${minutos}`;
    } catch (error) {
        console.warn('Erro ao formatar data para exibição:', error);
        return datetimeLocal;
    }
}


    // ===== INICIALIZAÇÃO DA APLICAÇÃO =====
    // Carrega as políticas e projetos no início
    await Promise.all([
        carregarPoliticas(),
        carregarProjetos()
    ]);

    // CHAMA A NOVA FUNÇÃO DE INICIALIZAÇÃO APÓS CARREGAR DADOS ESSENCIAIS
    await inicializarFormulario();
});

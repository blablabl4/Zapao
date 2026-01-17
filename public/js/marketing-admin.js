// Marketing / Web Push Admin Logic

document.addEventListener('DOMContentLoaded', () => {
    loadCampaigns();
});

async function loadCampaigns() {
    const tbody = document.getElementById('campaignsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Carregando...</td></tr>';

    try {
        const res = await fetch('/api/marketing/campaigns');
        const data = await res.json();

        if (!data.campaigns || data.campaigns.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhuma campanha criada.</td></tr>';
            return;
        }

        tbody.innerHTML = data.campaigns.map(c => {
            const dateStr = new Date(c.created_at).toLocaleString('pt-BR');
            let sched = 'Imediato';
            if (c.scheduled_for) {
                const sDate = new Date(c.scheduled_for);
                if (sDate > new Date()) sched = `Agendado: ${sDate.toLocaleString('pt-BR')}`;
                else sched = `Enviado em: ${sDate.toLocaleString('pt-BR')}`;
            }

            const sendBtn = c.status === 'DRAFT' || c.status === 'SCHEDULED'
                ? `<button class="btn btn-sm btn-gold" onclick="sendCampaign(${c.id})" style="background:var(--gold); border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold;">🚀 Enviar</button>`
                : `<span style="color:#aaa;">-</span>`;

            let ctr = '0%';
            if (c.sent_count > 0) {
                ctr = ((c.clicked_count / c.sent_count) * 100).toFixed(1) + '%';
            }

            return `
                <tr>
                    <td><span class="status-pill ${c.status.toLowerCase()}">${c.status}</span></td>
                    <td><strong>${c.title}</strong><br><span style="font-size:0.8em; color:#888;">${c.body}</span></td>
                    <td>${sched}</td>
                    <td style="text-align:center;">${c.sent_count || 0}</td>
                    <td style="text-align:center;">${c.clicked_count || 0}</td>
                    <td style="text-align:center;">${ctr}</td>
                    <td style="text-align:right;">${sendBtn}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center;">Erro ao carregar campanhas.</td></tr>';
    }
}

function openCampaignModal() {
    document.getElementById('campaignModal').style.display = 'flex';
}

function closeCampaignModal() {
    document.getElementById('campaignModal').style.display = 'none';
}

async function saveCampaign() {
    const title = document.getElementById('campTitle').value;
    const body = document.getElementById('campBody').value;
    const icon = document.getElementById('campIcon').value;
    const url = document.getElementById('campUrl').value;
    const scheduleType = document.getElementById('campSchedule').value;
    const scheduleTime = document.getElementById('campScheduleTime').value;

    if (!title || !body) return alert('Título e Mensagem são obrigatórios!');

    let scheduledFor = null;
    if (scheduleType === 'later') {
        if (!scheduleTime) return alert('Selecione a data/hora para agendamento.');
        scheduledFor = new Date(scheduleTime).toISOString();
    }

    try {
        const res = await fetch('/api/marketing/campaign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title, body, icon, url,
                scheduled_for: scheduledFor
            })
        });

        if (res.ok) {
            alert('Campanha criada com sucesso!');
            closeCampaignModal();
            loadCampaigns();
        } else {
            const err = await res.json();
            alert('Erro: ' + err.error);
        }
    } catch (e) {
        alert('Erro de conexão: ' + e.message);
    }
}

async function sendCampaign(id) {
    if (!confirm('Deseja disparar esta campanha agora para TODOS os inscritos?')) return;

    try {
        const res = await fetch(`/api/marketing/campaign/${id}/send`, { method: 'POST' });
        const data = await res.json();

        if (res.ok) {
            alert(`Disparo iniciado! ${data.count} mensagens na fila.`);
            loadCampaigns();
        } else {
            alert('Erro: ' + data.error);
        }
    } catch (e) {
        alert('Erro: ' + e.message);
    }
}

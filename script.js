$(document).ready(function() {
    // Função para obter as coordenadas e passá-las para o map.html
    function getCoordinates() {
        $.ajax({
            type: 'GET',
            url: 'URL_DA_SUA_API', // Substitua 'URL_DA_SUA_API' pela URL real da sua API
            success: function(response) {
                // Processar as coordenadas recebidas da API
                var x = response.x; // Supondo que a resposta contenha os valores de x, y e z
                var y = response.y;
                var z = response.z;

                // Passar as coordenadas para o map.html usando localStorage
                localStorage.setItem('xCoord', x);
                localStorage.setItem('yCoord', y);
                localStorage.setItem('zCoord', z);

                // Recarregar o map.html
                location.reload();
            },
            error: function(xhr, status, error) {
                console.error('Erro ao obter coordenadas da API:', error);
            }
        });
    }

    // Chamar a função para obter as coordenadas quando o documento estiver pronto
    getCoordinates();
});

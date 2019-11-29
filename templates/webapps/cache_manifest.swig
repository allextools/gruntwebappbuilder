CACHE MANIFEST
# TIMESTAMP: <% print (Date.now()) %>

<% if (cache) { print("CACHE:\n"); _.forEach (cache, function (c) {print(c+"\n");})} %>
<% print("NETWORK:"); %>
<% if (network) {  _.forEach(network, function (n) {print(n+"\n");})} else { print ("*\n"); } %>
<% if (fallback) { print("FALLBACK:\n"); _.forEach(fallback, function (f,k) {print(k+" "+f+"\n");})} %>

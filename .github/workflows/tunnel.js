name: Secure RDP via Remote Node Script

on:
  workflow_dispatch:

jobs:
  secure-rdp:
    runs-on: windows-latest
    timeout-minutes: 3600

    steps:
      - name: Configure Core RDP Settings
        run: |
          # [span_0](start_span)Bật RDP và cấu hình bảo mật thấp để dễ kết nối[span_0](end_span)
          Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name "fDenyTSConnections" -Value 0 -Force
          Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name "UserAuthentication" -Value 0 -Force
          Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name "SecurityLayer" -Value 0 -Force
          
          # [span_1](start_span)Mở firewall cho port 3389[span_1](end_span)
          netsh advfirewall firewall add rule name="RDP-Tunnel" dir=in action=allow protocol=TCP localport=3389
          Restart-Service -Name TermService -Force

      - name: Create RDP User
        run: |
          # [span_2](start_span)[span_3](start_span)Logic tạo mật khẩu ngẫu nhiên bảo mật[span_2](end_span)[span_3](end_span)
          $password = -join ((65..90 + 97..122 + 48..57 + 33..47) | Get-Random -Count 16 | % {[char]$_})
          $securePass = ConvertTo-SecureString $password -AsPlainText -Force
          New-LocalUser -Name "RDP_User" -Password $securePass -AccountNeverExpires
          Add-LocalGroupMember -Group "Administrators" -Member "RDP_User"
          Add-LocalGroupMember -Group "Remote Desktop Users" -Member "RDP_User"
          
          # [span_4](start_span)Lưu mật khẩu vào môi trường để hiển thị sau[span_4](end_span)
          echo "RDP_PASSWORD=$password" >> $env:GITHUB_ENV

      - name: Fetch and Run Tunnel Script
        shell: powershell
        env:
          TUNNEL_REMOTE_HOST: ${{ secrets.REMOTE_HOST }}
          TUNNEL_REMOTE_PORT: ${{ secrets.REMOTE_PORT }}
          TUNNEL_LOCAL_PORT: 3389
          TUNNEL_SERVICE: "rdp"
        run: |
          # URL trỏ đến file tunnel-public.js của bạn (ví dụ trên GitHub Gist)
          $url = "https://raw.githubusercontent.com/username/repo/main/tunnel.js"
          
          Write-Host "Downloading tunnel script..."
          Invoke-WebRequest -Uri $url -OutFile "tunnel.js"
          
          Write-Host "Starting Tunnel in background..."
          Start-Process node -ArgumentList "tunnel.js"
          
      - name: Maintain Connection
        run: |
          Write-Host "`n=== RDP ACCESS INFO ==="
          Write-Host "Connect to: ${{ secrets.REMOTE_HOST }}:${{ secrets.REMOTE_PORT }}"
          Write-Host "Username: RDP_User"
          Write-Host "Password: $env:RDP_PASSWORD"
          Write-Host "========================`n"
          
          # [span_5](start_span)Giữ Runner hoạt động[span_5](end_span)
          while ($true) {
              Write-Host "[$(Get-Date)] Tunnel is running..."
              Start-Sleep -Seconds 300
          }

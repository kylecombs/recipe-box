-- Run this as MySQL root user to grant necessary permissions
GRANT CREATE, ALTER, DROP, REFERENCES ON *.* TO 'kylecombs'@'%';
FLUSH PRIVILEGES;
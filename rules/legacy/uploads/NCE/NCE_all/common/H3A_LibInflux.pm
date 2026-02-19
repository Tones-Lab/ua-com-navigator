use Assure1::InfluxDB::Client;

sub LibInflux_GetClient {
	my $host = shift;
	
    my $trace = 'LibInflux_GetClient';
	$Log->Message('DEBUG', $trace . " started...");
    $Log->Message('DEBUG', $trace . " Arguments: \$host: '".$host."'");

	unless(defined $client) {
    	$Log->Message('DEBUG', $trace . " create new client...");
    	$client = Assure1::InfluxDB::Client->new(host => $host);
    } 
    
    if (defined $client && !$client->ping()) {
    	undef $client;
        $client = Assure1::InfluxDB::Client->new(host => $host);
    } else {
       return $client;
    }

	$Log->Message('DEBUG', $trace . " ...done") ;
}


sub LibInflux_WriteMetric {
	my ($client,$measurement, $tags, $metric) = @_;   
    my $trace = 'LibInflux_WriteMetric';
	$Log->Message('DEBUG', $trace . " started...") ;

	if (defined $client && $client->ping()) {
    	#######Inserting tag field and value ##################
    	while(my ($tag_key, $tag_value) = each (%$tags)) {
	        $Log->Message('DEBUG', $trace . " Value of $tag_key is $tag_value");
	        $measurement .= "," . $tag_key . "=" . $tag_value ;
	    }
	    $measurement .= " " ;

    	#######Inserting metric field and  value ##################
        while(my ($val_key, $val_value) = each (%$metric)) {
        	$Log->Message('DEBUG',$trace . " Value of $val_key is $val_value");
        	$measurement .=  $val_key . "=" . $val_value ;
    	}
    	$Log->Message('DEBUG',$trace . " Complete Measurment String: '" . $measurement . "'");

		if ( $client->write($measurement, database => "Metric")) {
            $Log->Message('DEBUG',$trace . " Metric successfully written.");
        	return (1, { message => "Metric successfully written." } );
		} else {
        	my $err = "ERR-04-001: Write of new metric to InfluxDB failed. Received Error: " . $client->error();
            $Log->Message('ERROR',$trace . " " . $err);
            return (0, { message => $err });
		}
    } else {
    	return (0, { message => "ERR-04-002: Write of new metric to InfluxDB failed. Received Error: " . $client->error() });
    }
    
	$Log->Message('DEBUG', $trace . " ...done") ;
}

1;